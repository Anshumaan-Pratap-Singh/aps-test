"""Progress, history and cohort benchmarks.

Benchmarks only use *server-validated assessment* sessions with an identical
(trainer_type, difficulty, config_key, generator_version) cohort inside a time
window. Cohorts below ``min_cohort_size`` are suppressed. Percentiles are
computed with PostgreSQL ordered-set aggregates (percentile_cont) and the
user's percentile rank with a mid-rank estimate.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import current_user
from app.engines.adaptive import mastery_display
from app.models.entities import GameSession, TrainingSession, User, UserSkillMastery

router = APIRouter(tags=["progress"])


@router.get("/progress/summary")
async def summary(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    agg = (await db.execute(select(
        func.count(TrainingSession.id), func.coalesce(func.sum(TrainingSession.total_attempts), 0),
        func.coalesce(func.sum(TrainingSession.correct_attempts), 0),
        func.percentile_cont(0.5).within_group(TrainingSession.median_response_us),
    ).where(TrainingSession.user_id == user.id, TrainingSession.total_attempts > 0))).one()
    games = await db.scalar(select(func.count(GameSession.id)).where(GameSession.user_id == user.id,
                                                                     GameSession.completed_at.isnot(None)))
    sessions, attempts, correct, med = agg
    return {"sessions": sessions, "attempts": int(attempts), "correct": int(correct),
            "accuracy": (correct / attempts) if attempts else None,
            "median_of_session_medians_us": float(med) if med is not None else None, "games_completed": games}


@router.get("/progress/skills")
async def skills(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(UserSkillMastery).where(UserSkillMastery.user_id == user.id)
                             .order_by(UserSkillMastery.skill_tag))).scalars().all()
    now = datetime.now(timezone.utc)
    return [{"skill_tag": m.skill_tag, "mastery": mastery_display(m.mastery_score, m.attempts),
             "raw_accuracy_ewma": m.mastery_score, "attempts": m.attempts, "correct": m.correct_attempts,
             "due_at": m.due_at.isoformat() if m.due_at else None, "is_due": bool(m.due_at and m.due_at <= now),
             "last_practised_at": m.last_practised_at.isoformat() if m.last_practised_at else None} for m in rows]


@router.get("/analytics/history")
async def history(trainer_type: str | None = None, days: int = Query(90, le=365), user: User = Depends(current_user),
                  db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = (select(func.date_trunc("day", TrainingSession.started_at).label("day"), TrainingSession.trainer_type,
                func.sum(TrainingSession.total_attempts), func.sum(TrainingSession.correct_attempts),
                func.percentile_cont(0.5).within_group(TrainingSession.median_response_us))
         .where(TrainingSession.user_id == user.id, TrainingSession.started_at >= since, TrainingSession.total_attempts > 0)
         .group_by(text("day"), TrainingSession.trainer_type).order_by(text("day")))
    if trainer_type:
        q = q.where(TrainingSession.trainer_type == trainer_type)
    return [{"day": d.date().isoformat(), "trainer_type": t, "attempts": int(a), "correct": int(c),
             "accuracy": c / a if a else None, "median_response_us": float(m) if m is not None else None}
            for d, t, a, c, m in (await db.execute(q)).all()]


@router.get("/analytics/benchmarks")
async def benchmarks(trainer_type: str, difficulty: int = Query(ge=1, le=10), config_key: str = "custom",
                     days: int = Query(90, le=365), user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    cohort = (TrainingSession.trainer_type == trainer_type, TrainingSession.difficulty == difficulty,
              TrainingSession.config_key == config_key, TrainingSession.mode == "assessment",
              TrainingSession.server_validated.is_(True), TrainingSession.session_status == "completed",
              TrainingSession.completed_at >= since)
    # one score per user (their best) so prolific users do not dominate the cohort
    best = (select(TrainingSession.user_id, func.max(TrainingSession.score).label("score"))
            .where(*cohort).group_by(TrainingSession.user_id).subquery())
    n, p10, p25, p50, p75, p90 = (await db.execute(select(
        func.count(), *[func.percentile_cont(p).within_group(best.c.score) for p in (0.1, 0.25, 0.5, 0.75, 0.9)]
    ).select_from(best))).one()
    mine = await db.scalar(select(best.c.score).where(best.c.user_id == user.id))
    min_n = get_settings().min_cohort_size
    result = {"cohort": {"trainer_type": trainer_type, "difficulty": difficulty, "config_key": config_key,
                         "window_days": days}, "sample_size": n, "min_cohort_size": min_n, "your_best_score": mine}
    if n < min_n:
        result.update(status="insufficient_data",
                      message=f"Cohort has {n} users; percentiles are suppressed below {min_n}.")
        return result
    pct = None
    if mine is not None:
        below = await db.scalar(select(func.count()).select_from(best).where(best.c.score < mine))
        equal = await db.scalar(select(func.count()).select_from(best).where(best.c.score == mine))
        pct = 100 * (below + 0.5 * equal) / n
    result.update(status="provisional" if n < 3 * min_n else "estimate",
                  quantiles={"p10": p10, "p25": p25, "p50": p50, "p75": p75, "p90": p90}, your_percentile=pct)
    return result
