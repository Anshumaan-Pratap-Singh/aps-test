from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import COOKIE_NAME, current_user
from app.models.entities import GameSession, QuestionAttempt, TrainingSession, User, UserSkillMastery
from app.schemas.api import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)):
    return user


@router.get("/me/export")
async def export_data(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """GDPR-style export of all data held about the user."""
    sessions = (await db.execute(select(TrainingSession).where(TrainingSession.user_id == user.id))).scalars().all()
    attempts = (await db.execute(select(QuestionAttempt).join(TrainingSession)
                                 .where(TrainingSession.user_id == user.id))).scalars().all()
    games = (await db.execute(select(GameSession).where(GameSession.user_id == user.id))).scalars().all()
    skills = (await db.execute(select(UserSkillMastery).where(UserSkillMastery.user_id == user.id))).scalars().all()

    def row(o):
        return {c.name: (str(v) if v is not None and not isinstance(v, (int, float, bool, str, list, dict)) else v)
                for c in o.__table__.columns if c.name != "password_hash" for v in [getattr(o, c.key)]}

    return {"user": row(user), "training_sessions": [row(s) for s in sessions],
            "question_attempts": [row(a) for a in attempts], "game_sessions": [row(g) for g in games],
            "skill_mastery": [row(s) for s in skills]}


@router.delete("/me", status_code=204)
async def delete_account(response: Response, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Hard-delete the account; FK cascades remove sessions, attempts, games and mastery."""
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
