"""Idempotently load the shared curriculum contract into role_tracks/track_sections/content_items.

Run: python -m app.seed
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.entities import ContentItem, RoleTrack, TrackSection

CURRICULUM = Path(os.environ.get("APS_CURRICULUM_PATH",
                                 Path(__file__).resolve().parents[3] / "packages" / "contracts" / "curriculum.json"))


async def seed(db: AsyncSession) -> int:
    data = json.loads(CURRICULUM.read_text())
    n = 0
    for t in data["tracks"]:
        await db.execute(insert(RoleTrack).values(id=t["id"], name=t["name"], description=t["description"],
                                                  version=data["version"])
                         .on_conflict_do_update(index_elements=["id"], set_={"name": t["name"], "description": t["description"],
                                                                             "version": data["version"]}))
        for order, s in enumerate(t["sections"]):
            await db.execute(insert(TrackSection).values(id=s["id"], role_track_id=t["id"], title=s["title"],
                                                         description=s["description"], display_order=order)
                             .on_conflict_do_update(index_elements=["id"], set_={"title": s["title"],
                                                                                 "description": s["description"]}))
            for it in s["items"]:
                vals = dict(id=it["id"], section_id=s["id"], content_type=it["type"], title=it["title"],
                            description=it.get("description", ""), difficulty=it["difficulty"],
                            estimated_duration=it["minutes"], content_version=data["version"], is_published=True)
                await db.execute(insert(ContentItem).values(**vals).on_conflict_do_update(
                    index_elements=["id"], set_={k: v for k, v in vals.items() if k != "id"}))
                n += 1
    await db.commit()
    return n


async def main() -> None:
    async for db in get_db():
        print(f"seeded {await seed(db)} content items")


if __name__ == "__main__":
    asyncio.run(main())
