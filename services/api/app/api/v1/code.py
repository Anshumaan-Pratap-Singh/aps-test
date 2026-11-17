"""Code-execution adapter.

Submitted code is NEVER executed in this API process. Execution is delegated to
a separate sandbox service (see docs/architecture.md §Code execution) addressed
by APS_SANDBOX_URL. Until that service is deployed this endpoint returns 501 and
the frontend runs public tests in the user's own browser (Pyodide, WebAssembly).
"""

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/code", tags=["code"])


class RunIn(BaseModel):
    problem_id: str = Field(max_length=80)
    language: str = Field(pattern=r"^(python|cpp)$")
    source: str = Field(max_length=64_000)


@router.get("/status")
async def status():
    url = os.environ.get("APS_SANDBOX_URL")
    return {"server_execution_enabled": bool(url),
            "message": "Server-side sandbox configured." if url else
            "Server-side execution is not enabled. Python runs locally in your browser (WebAssembly); C++ is not executable yet."}


@router.post("/run")
async def run(_: RunIn):
    if not os.environ.get("APS_SANDBOX_URL"):
        raise HTTPException(501, "server-side code execution is not enabled in this deployment")
    raise HTTPException(501, "sandbox client not implemented")  # adapter boundary; see docs
