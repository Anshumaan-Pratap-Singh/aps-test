"""Authentication primitives.

* Password hashing: pwdlib (Argon2id) — maintained library, no custom crypto.
* Session tokens: signed JWT (PyJWT, HS256) delivered in an HttpOnly, SameSite=Lax
  cookie. Bearer tokens are also accepted for non-browser clients.
* CSRF: cookie-authenticated unsafe requests must carry the ``X-APS-CSRF`` header.
  Browsers cannot attach custom headers cross-origin without a CORS preflight,
  which our CORS policy denies for foreign origins.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from pwdlib import PasswordHash
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.models.entities import User

COOKIE_NAME = "aps_session"
CSRF_HEADER = "x-aps-csrf"
_hasher = PasswordHash.recommended()


def hash_password(pw: str) -> str:
    return _hasher.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return _hasher.verify(pw, hashed)


def create_token(user_id: uuid.UUID) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=s.jwt_ttl_minutes)},
                      s.jwt_secret, algorithm="HS256")


def _decode(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired session") from exc


async def current_user_optional(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    token = None
    auth = request.headers.get("authorization", "")
    via_cookie = False
    if auth.lower().startswith("bearer "):
        token = auth[7:]
    elif COOKIE_NAME in request.cookies:
        token = request.cookies[COOKIE_NAME]
        via_cookie = True
    if not token:
        return None
    if via_cookie and request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get(CSRF_HEADER) != "1":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "missing CSRF header")
    user = await db.get(User, _decode(token))
    if user is None or user.account_status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "account unavailable")
    return user


async def current_user(user: User | None = Depends(current_user_optional)) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "authentication required")
    return user
