import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import current_user
from app.models.entities import QuestionAttempt, TrainingSession, User
from app.schemas.api import AssessmentStartIn, AttemptBatchIn, SessionOut
from app.services import sessions as svc

router = APIRouter(tags=["sessions"])


@router.post("/sessions/assessment", status_code=201)
async def start_assessment(body: AssessmentStartIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Server-generated assessment: answers are withheld and grading happens server-side."""
    session, questions = await svc.start_assessment(db, user, body)
    return {"session": SessionOut.model_validate(session).model_dump(mode="json"),
            "client_session_id": session.client_session_id, "questions": questions}


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(trainer_type: str | None = None, limit: int = Query(50, le=200), offset: int = Query(0, ge=0),
                        user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    q = (select(TrainingSession).where(TrainingSession.user_id == user.id)
         .order_by(TrainingSession.started_at.desc()).limit(limit).offset(offset))
    if trainer_type:
        q = q.where(TrainingSession.trainer_type == trainer_type)
    return (await db.execute(q)).scalars().all()


@router.get("/sessions/{session_id}")
async def get_session(session_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    s = await db.get(TrainingSession, session_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "session not found")
    attempts = (await db.execute(select(QuestionAttempt).where(QuestionAttempt.session_id == s.id)
                                 .order_by(QuestionAttempt.attempt_number))).scalars().all()
    return {"session": SessionOut.model_validate(s).model_dump(mode="json"),
            "attempts": [{"question_id": a.question_id, "question_type": a.question_type, "question_seed": a.question_seed,
                          "submitted_answer": a.submitted_answer, "is_correct": a.is_correct,
                          "response_us": a.response_us, "attempt_number": a.attempt_number} for a in attempts]}


@router.post("/attempts/batch")
async def attempts_batch(body: AttemptBatchIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Idempotent: re-sending the same idempotency_key or client_event_id never duplicates attempts."""
    return await svc.ingest_batch(db, user, body)
