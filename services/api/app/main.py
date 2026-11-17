import json
import logging
import time
import uuid

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import auth, code, games, progress, questions, sessions, tracks, users
from app.core.config import get_settings


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = {"level": record.levelname, "logger": record.name, "msg": record.getMessage()}
        base.update(getattr(record, "extra_fields", {}))
        return json.dumps(base)


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
log = logging.getLogger("aps.http")

settings = get_settings()
app = FastAPI(title="APS API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "DELETE"], allow_headers=["content-type", "x-aps-csrf", "authorization"])


@app.middleware("http")
async def access_log(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    t0 = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled error", extra={"extra_fields": {"request_id": rid, "path": request.url.path}})
        return JSONResponse({"detail": "internal error", "request_id": rid}, status_code=500)
    ms = (time.perf_counter() - t0) * 1000
    # Never log bodies, cookies or auth headers.
    log.info("request", extra={"extra_fields": {"request_id": rid, "method": request.method, "path": request.url.path,
                                                "status": response.status_code, "latency_ms": round(ms, 2)}})
    response.headers["x-request-id"] = rid
    return response


v1 = APIRouter(prefix="/api/v1")
for r in (auth.router, users.router, tracks.router, questions.router, sessions.router, games.router, progress.router,
          code.router):
    v1.include_router(r)
app.include_router(v1)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
