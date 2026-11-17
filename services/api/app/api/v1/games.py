import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import current_user
from app.models.entities import GameEvent, GameSession, User
from app.schemas.api import GameCompleteIn, GameEventIn, GameSessionIn

router = APIRouter(prefix="/games", tags=["games"])

GAME_TYPES = {"market_making", "etf_arbitrage", "event_contracts", "fermi", "betting_board",
              "task_switch", "response_conflict", "pincode"}


def _out(g: GameSession) -> dict:
    return {"id": str(g.id), "game_type": g.game_type, "difficulty": g.difficulty, "seed": g.seed,
            "score": g.score, "metrics": g.metrics,
            "realised_pnl": f"{g.realised_pnl:.6f}" if g.realised_pnl is not None else None,
            "mark_to_market_pnl": f"{g.mark_to_market_pnl:.6f}" if g.mark_to_market_pnl is not None else None,
            "started_at": g.started_at.isoformat() if g.started_at else None,
            "completed_at": g.completed_at.isoformat() if g.completed_at else None}


@router.get("")
async def list_games(game_type: str | None = None, limit: int = Query(50, le=200),
                     user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    q = select(GameSession).where(GameSession.user_id == user.id).order_by(GameSession.started_at.desc()).limit(limit)
    if game_type:
        q = q.where(GameSession.game_type == game_type)
    return [_out(g) for g in (await db.execute(q)).scalars().all()]


@router.post("/{game_type}/sessions", status_code=201)
async def create_game(game_type: str, body: GameSessionIn, user: User = Depends(current_user),
                      db: AsyncSession = Depends(get_db)):
    if game_type not in GAME_TYPES:
        raise HTTPException(404, "unknown game type")
    existing = (await db.execute(select(GameSession).where(GameSession.client_session_id == body.client_session_id))).scalar_one_or_none()
    if existing:
        if existing.user_id != user.id:
            raise HTTPException(403, "forbidden")
        return _out(existing)
    g = GameSession(user_id=user.id, game_type=game_type, client_session_id=body.client_session_id,
                    difficulty=body.difficulty, seed=body.seed, engine_version=body.engine_version,
                    initial_state=body.initial_state)
    db.add(g)
    await db.commit()
    return _out(g)


async def _owned(db: AsyncSession, game_session_id: uuid.UUID, user: User) -> GameSession:
    g = await db.get(GameSession, game_session_id)
    if g is None or g.user_id != user.id:
        raise HTTPException(404, "game session not found")
    return g


async def _insert_events(db: AsyncSession, g: GameSession, events: list[GameEventIn]) -> int:
    if not events:
        return 0
    rows = [dict(id=uuid.uuid4(), game_session_id=g.id, sequence_number=e.sequence_number, event_type=e.event_type,
                 event_payload=e.event_payload, event_timestamp=e.event_timestamp) for e in events]
    r = await db.execute(insert(GameEvent).values(rows)
                         .on_conflict_do_nothing(constraint="uq_game_event_seq").returning(GameEvent.id))
    return len(r.fetchall())


@router.post("/{game_session_id}/events")
async def add_events(game_session_id: uuid.UUID, events: list[GameEventIn], user: User = Depends(current_user),
                     db: AsyncSession = Depends(get_db)):
    g = await _owned(db, game_session_id, user)
    if g.completed_at:
        raise HTTPException(409, "game already completed")
    n = await _insert_events(db, g, events[:5000])
    await db.commit()
    return {"accepted": n, "duplicates": len(events) - n}


@router.get("/{game_session_id}/events")
async def get_events(game_session_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Development/inspection: full ordered event log for replay."""
    g = await _owned(db, game_session_id, user)
    evs = (await db.execute(select(GameEvent).where(GameEvent.game_session_id == g.id)
                            .order_by(GameEvent.sequence_number))).scalars().all()
    return {"game": _out(g), "initial_state": g.initial_state,
            "events": [{"seq": e.sequence_number, "type": e.event_type, "payload": e.event_payload,
                        "t": e.event_timestamp} for e in evs]}


@router.post("/{game_session_id}/complete")
async def complete_game(game_session_id: uuid.UUID, body: GameCompleteIn, user: User = Depends(current_user),
                        db: AsyncSession = Depends(get_db)):
    g = await _owned(db, game_session_id, user)
    if g.completed_at:
        return _out(g)  # idempotent
    await _insert_events(db, g, body.events)
    g.final_state = body.final_state
    g.metrics = {**body.metrics, "server_validated": False}
    g.score = body.score
    g.realised_pnl = Decimal(body.realised_pnl) if body.realised_pnl else None
    g.mark_to_market_pnl = Decimal(body.mark_to_market_pnl) if body.mark_to_market_pnl else None
    g.completed_at = datetime.now(timezone.utc)
    await db.commit()
    return _out(g)
