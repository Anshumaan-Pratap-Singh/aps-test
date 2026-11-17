from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.models.entities import ContentItem, RoleTrack, TrackSection

router = APIRouter(tags=["content"])


def _item(i: ContentItem) -> dict:
    return {"id": i.id, "section_id": i.section_id, "content_type": i.content_type, "title": i.title,
            "description": i.description, "difficulty": i.difficulty, "estimated_duration": i.estimated_duration,
            "content_version": i.content_version}


@router.get("/tracks")
async def list_tracks(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(RoleTrack).order_by(RoleTrack.id))).scalars().all()
    return [{"id": t.id, "name": t.name, "description": t.description, "version": t.version} for t in rows]


@router.get("/tracks/{track_id}")
async def get_track(track_id: str, db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(RoleTrack).where(RoleTrack.id == track_id)
                          .options(selectinload(RoleTrack.sections).selectinload(TrackSection.items)))).scalar_one_or_none()
    if t is None:
        raise HTTPException(404, "track not found")
    return {"id": t.id, "name": t.name, "description": t.description, "version": t.version,
            "sections": [{"id": s.id, "title": s.title, "description": s.description, "display_order": s.display_order,
                          "items": [_item(i) for i in s.items if i.is_published]} for s in t.sections]}


@router.get("/content")
async def list_content(content_type: str | None = None, limit: int = Query(50, le=200), offset: int = Query(0, ge=0),
                       db: AsyncSession = Depends(get_db)):
    q = select(ContentItem).where(ContentItem.is_published.is_(True)).order_by(ContentItem.id).limit(limit).offset(offset)
    if content_type:
        q = q.where(ContentItem.content_type == content_type)
    return [_item(i) for i in (await db.execute(q)).scalars().all()]


@router.get("/content/{content_id}")
async def get_content(content_id: str, db: AsyncSession = Depends(get_db)):
    i = await db.get(ContentItem, content_id)
    if i is None or not i.is_published:
        raise HTTPException(404, "content not found")
    return _item(i)
