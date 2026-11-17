"""Fixed-window rate limiting (Redis if available, in-process fallback)."""

from __future__ import annotations

import logging
import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.core.config import get_settings

log = logging.getLogger("aps.ratelimit")
_local: dict[str, tuple[int, int]] = defaultdict(lambda: (0, 0))
_redis = None
_redis_checked = False


def _get_redis():
    global _redis, _redis_checked
    if _redis_checked:
        return _redis
    _redis_checked = True
    url = get_settings().redis_url
    if not url:
        return None
    try:
        import redis

        r = redis.Redis.from_url(url, socket_timeout=0.2, socket_connect_timeout=0.2)
        r.ping()
        _redis = r
    except Exception:  # noqa: BLE001 - redis is optional
        log.warning("redis unavailable; using in-process rate limiting")
        _redis = None
    return _redis


def check_rate(key: str, limit: int, window_s: int = 60) -> None:
    bucket = int(time.time() // window_s)
    r = _get_redis()
    if r is not None:
        try:
            k = f"rl:{key}:{bucket}"
            n = r.incr(k)
            if n == 1:
                r.expire(k, window_s)
            if n > limit:
                raise HTTPException(429, "rate limit exceeded")
            return
        except HTTPException:
            raise
        except Exception:  # noqa: BLE001
            pass
    b, n = _local[key]
    n = n + 1 if b == bucket else 1
    _local[key] = (bucket, n)
    if n > limit:
        raise HTTPException(429, "rate limit exceeded")


def rate_limit(scope: str, per_minute: int | None = None, auth: bool = False):
    async def dep(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        s = get_settings()
        limit = s.auth_rate_limit_per_minute if auth else (per_minute or s.rate_limit_per_minute)
        check_rate(f"{scope}:{ip}", limit)

    return dep
