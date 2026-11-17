import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.core.security import current_user_optional
from app.engines.questions.base import GenerationError
from app.engines.questions.registry import REGISTRY, generate, generate_batch
from app.models.entities import TrainingSession, User
from app.schemas.api import GenerateIn, ValidateIn
from app.services.sessions import BATCH_SEED_MULT

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("/types")
async def types():
    return [{"key": k, "title": s.title, "skill_tags": list(s.skill_tags)} for k, s in REGISTRY.items()]


@router.post("/generate", dependencies=[Depends(rate_limit("generate", 120))])
async def generate_questions(body: GenerateIn):
    """Practice/learning batches include answers + solutions so the client can grade locally (offline).

    Competitive results never come from these batches: use /sessions/assessment.
    """
    if body.question_type not in REGISTRY:
        raise HTTPException(404, "unknown question type")
    seed = body.seed if body.seed is not None else secrets.randbelow(2**31)
    try:
        qs = generate_batch(body.question_type, seed, body.difficulty, body.count)
    except GenerationError as exc:
        raise HTTPException(500, "question generation failed verification") from exc
    return {"seed": seed, "questions": [q.public_payload(include_answer=True) for q in qs]}


@router.post("/validate", dependencies=[Depends(rate_limit("validate", 240))])
async def validate(body: ValidateIn, user: User | None = Depends(current_user_optional),
                   db: AsyncSession = Depends(get_db)):
    if body.question_type not in REGISTRY:
        raise HTTPException(404, "unknown question type")
    if user is not None:
        active = await db.execute(select(TrainingSession.id).where(
            TrainingSession.user_id == user.id, TrainingSession.mode == "assessment",
            TrainingSession.session_status == "active", TrainingSession.seed == body.seed // BATCH_SEED_MULT))
        if active.first():
            raise HTTPException(403, "cannot validate questions from an active assessment")
    q = generate(body.question_type, body.seed, body.difficulty)
    ok = q.check(body.answer)
    return {"question_id": q.question_id, "correct": ok, "answer_display": q.answer_display,
            "solution_steps": q.visible_solution_steps(), "hint_steps": list(q.hint_steps)}
