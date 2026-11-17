"""Training-session persistence: idempotent batch ingestion and server-side grading."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines import adaptive, stats
from app.engines.questions.registry import REGISTRY, generate
from app.models.entities import IdempotencyKey, QuestionAttempt, TrainingSession, User, UserSkillMastery

BATCH_SEED_MULT = 100003


async def ingest_batch(db: AsyncSession, user: User, payload) -> dict:
    key = hashlib.sha256(f"{user.id}:{payload.idempotency_key}".encode()).hexdigest()  # fixed length, per-user namespace
    existing = await db.get(IdempotencyKey, key)
    if existing is not None:
        return existing.response

    sd = payload.session
    res = await db.execute(select(TrainingSession).where(TrainingSession.client_session_id == sd.client_session_id))
    session = res.scalar_one_or_none()
    if session is None:
        if sd.mode == "assessment":
            raise HTTPException(400, "assessment sessions must be started via /sessions/assessment")
        session = TrainingSession(
            user_id=user.id, trainer_type=sd.trainer_type, mode="practice", config_key=sd.config_key or "",
            difficulty=sd.difficulty, seed=sd.seed, question_count=sd.question_count,
            duration_limit_s=sd.duration_limit_s, client_session_id=sd.client_session_id,
            started_at=sd.started_at or datetime.now(timezone.utc),
        )
        db.add(session)
        await db.flush()
    elif session.user_id != user.id:
        raise HTTPException(403, "session belongs to another user")
    if session.session_status == "completed":
        raise HTTPException(409, "session already completed")

    rows = []
    for a in payload.attempts:
        correct = a.is_correct
        if session.mode == "assessment":
            correct = _grade_assessment_attempt(session, a)
        rows.append(dict(
            id=uuid.uuid4(), session_id=session.id, client_event_id=_scoped_event_id(user.id, a.client_event_id),
            question_id=a.question_id, question_type=a.question_type, question_version=a.question_version,
            question_seed=a.question_seed, skill_tags=a.skill_tags, submitted_answer=a.submitted_answer,
            is_correct=correct, response_us=a.response_us, attempt_number=a.attempt_number,
        ))
    inserted = 0
    if rows:
        stmt = insert(QuestionAttempt).values(rows).on_conflict_do_nothing(index_elements=["client_event_id"])
        r = await db.execute(stmt.returning(QuestionAttempt.id))
        new_ids = {row[0] for row in r.fetchall()}
        inserted = len(new_ids)
        await _update_mastery(db, user, [row for row in rows if row["id"] in new_ids])

    await _recompute(db, session, payload.duration_us)
    if payload.complete:
        session.session_status = "completed"
        session.completed_at = datetime.now(timezone.utc)
    user.last_active_at = datetime.now(timezone.utc)
    response = {"session_id": str(session.id), "accepted": inserted, "duplicates": len(rows) - inserted,
                "server_validated": session.server_validated, "accuracy": session.accuracy,
                "correct": session.correct_attempts, "total": session.total_attempts, "score": session.score}
    db.add(IdempotencyKey(key=key, user_id=user.id, response=response))
    try:
        await db.commit()
    except IntegrityError:
        # A concurrent identical request committed first; return its stored response.
        await db.rollback()
        stored = await db.get(IdempotencyKey, key)
        if stored is None:
            raise
        return stored.response
    return response


def _scoped_event_id(user_id: uuid.UUID, client_event_id: str) -> str:
    """Namespace client event ids per user without truncation collisions."""
    return hashlib.sha256(f"{user_id}:{client_event_id}".encode()).hexdigest()


def _grade_assessment_attempt(session: TrainingSession, a) -> bool:
    """Regenerate the question from the session seed and grade the submitted answer."""
    base = a.question_seed // BATCH_SEED_MULT
    idx = a.question_seed % BATCH_SEED_MULT
    if base != session.seed or (session.question_count is not None and idx >= session.question_count):
        raise HTTPException(400, "attempt does not belong to this assessment")
    q = generate(session.trainer_type, a.question_seed, session.difficulty)
    if q.question_id != a.question_id:
        raise HTTPException(400, "question id mismatch (generator version changed?)")
    return q.check(a.submitted_answer)


async def _recompute(db: AsyncSession, session: TrainingSession, duration_us: int | None) -> None:
    res = await db.execute(select(QuestionAttempt.is_correct, QuestionAttempt.response_us)
                           .where(QuestionAttempt.session_id == session.id).order_by(QuestionAttempt.attempt_number))
    data = res.all()
    s = stats.compute([r[0] for r in data], [r[1] for r in data], duration_us)
    session.total_attempts = s.attempts
    session.correct_attempts = s.correct
    session.accuracy = s.accuracy if s.attempts else None
    session.average_response_us = s.mean_us
    session.median_response_us = s.median_us
    session.p90_response_us = s.p90_us
    session.score = s.net_score


async def _update_mastery(db: AsyncSession, user: User, rows: list[dict]) -> None:
    per_skill: dict[str, list[int]] = {}
    for r in rows:
        for tag in r["skill_tags"] or []:
            c = per_skill.setdefault(tag, [0, 0])
            c[0] += int(r["is_correct"])
            c[1] += 1
    now = datetime.now(timezone.utc)
    for tag, (c, n) in per_skill.items():
        res = await db.execute(select(UserSkillMastery).where(UserSkillMastery.user_id == user.id,
                                                              UserSkillMastery.skill_tag == tag))
        m = res.scalar_one_or_none()
        if m is None:
            m = UserSkillMastery(user_id=user.id, skill_tag=tag, mastery_score=0.0, attempts=0, correct_attempts=0,
                                 ease=2.5, interval_days=0.0, repetitions=0)
            db.add(m)
        m.mastery_score = adaptive.mastery(m.mastery_score, m.attempts, c, n)
        m.attempts += n
        m.correct_attempts += c
        rs = adaptive.schedule_review(adaptive.ReviewState(m.ease, m.interval_days, m.repetitions, m.due_at), c / n, now)
        m.ease, m.interval_days, m.repetitions, m.due_at = rs.ease, rs.interval_days, rs.repetitions, rs.due_at
        m.last_practised_at = now


async def start_assessment(db: AsyncSession, user: User, body) -> tuple[TrainingSession, list[dict]]:
    if body.trainer_type not in REGISTRY:
        raise HTTPException(404, "unknown trainer type")
    import secrets

    seed = secrets.randbelow(2**31)
    session = TrainingSession(
        user_id=user.id, trainer_type=body.trainer_type, mode="assessment", config_key=body.config_key,
        difficulty=body.difficulty, seed=seed, question_count=body.question_count,
        duration_limit_s=body.duration_limit_s, server_validated=True,
        client_session_id=f"srv-{uuid.uuid4().hex}",
    )
    db.add(session)
    await db.commit()
    qs = [generate(body.trainer_type, seed * BATCH_SEED_MULT + i, body.difficulty).public_payload(include_answer=False)
          for i in range(body.question_count)]
    return session, qs
