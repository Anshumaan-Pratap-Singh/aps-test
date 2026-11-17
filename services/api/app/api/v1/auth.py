from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.core.security import COOKIE_NAME, create_token, current_user, hash_password, verify_password
from app.models.entities import User
from app.schemas.api import LoginIn, RegisterIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# Constant-time-ish dummy verify so unknown emails cost the same as wrong passwords.
_DUMMY_HASH = hash_password("dummy-password-for-timing")


def _set_cookie(resp: Response, token: str) -> None:
    s = get_settings()
    resp.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", secure=s.cookie_secure,
                    max_age=s.jwt_ttl_minutes * 60, path="/")


@router.post("/register", response_model=UserOut, status_code=201, dependencies=[Depends(rate_limit("register", auth=True))])
async def register(body: RegisterIn, response: Response, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    exists = await db.scalar(select(func.count()).select_from(User).where(User.email == email))
    if exists:
        raise HTTPException(409, "email already registered")
    user = User(email=email, password_hash=hash_password(body.password), display_name=body.display_name)
    db.add(user)
    await db.commit()
    _set_cookie(response, create_token(user.id))
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(rate_limit("login", auth=True))])
async def login(body: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == body.email.lower()))).scalar_one_or_none()
    if user is None or not user.password_hash:
        verify_password(body.password, _DUMMY_HASH)
        raise HTTPException(401, "invalid credentials")
    if not verify_password(body.password, user.password_hash) or user.account_status != "active":
        raise HTTPException(401, "invalid credentials")
    _set_cookie(response, create_token(user.id))
    return user


@router.post("/logout", status_code=204)
async def logout(response: Response, _: User = Depends(current_user)):
    response.delete_cookie(COOKIE_NAME, path="/")
