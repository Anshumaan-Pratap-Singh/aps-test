import os
import subprocess
import sys
from pathlib import Path

import pytest

TEST_DB = os.environ.get("APS_TEST_DATABASE_URL", "postgresql+asyncpg://aps:aps@localhost:5432/aps_test")
os.environ["APS_DATABASE_URL"] = TEST_DB
os.environ["APS_ENV"] = "test"
os.environ.setdefault("APS_REDIS_URL", "")
os.environ["APS_MIN_COHORT_SIZE"] = "3"
os.environ["APS_AUTH_RATE_LIMIT_PER_MINUTE"] = "1000"

API_DIR = Path(__file__).resolve().parents[1]


def _db_available() -> bool:
    import asyncio

    import asyncpg

    async def ping():
        conn = await asyncpg.connect(TEST_DB.replace("+asyncpg", ""), timeout=2)
        await conn.close()

    try:
        asyncio.run(ping())
        return True
    except Exception:  # noqa: BLE001
        return False


@pytest.fixture(scope="session")
def migrated_db():
    if not _db_available():
        pytest.skip("PostgreSQL test database not available")
    env = {**os.environ, "APS_DATABASE_URL": TEST_DB}
    for cmd in (["downgrade", "base"], ["upgrade", "head"]):
        subprocess.run([sys.executable, "-m", "alembic", *cmd], cwd=API_DIR, env=env, check=True, capture_output=True)
    return TEST_DB


@pytest.fixture(scope="session")
async def client(migrated_db):
    import httpx

    from app.core.db import get_db, reset_engine
    from app.main import app
    from app.seed import seed

    reset_engine(migrated_db)
    async for db in get_db():
        await seed(db)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def register(client, email: str, password: str = "correct-horse-battery"):
    import httpx

    r = await client.post("/api/v1/auth/register", json={"email": email, "password": password, "display_name": "T"})
    assert r.status_code == 201, r.text
    # use bearer auth per user so tests can juggle multiple users on one client
    from app.core.security import create_token
    import uuid

    return {"Authorization": f"Bearer {create_token(uuid.UUID(r.json()['id']))}"}
