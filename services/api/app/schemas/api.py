from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    display_name: str
    created_at: datetime


class GenerateIn(BaseModel):
    question_type: str
    difficulty: int = Field(ge=1, le=10)
    count: int = Field(default=20, ge=1, le=200)
    seed: int | None = Field(default=None, ge=0, le=2**53)
    mode: Literal["practice", "learning"] = "practice"


class ValidateIn(BaseModel):
    question_type: str
    difficulty: int = Field(ge=1, le=10)
    seed: int = Field(ge=0)
    answer: str = Field(max_length=64)


class AssessmentStartIn(BaseModel):
    trainer_type: str
    difficulty: int = Field(ge=1, le=10)
    question_count: int = Field(ge=1, le=200)
    duration_limit_s: int | None = Field(default=None, ge=10, le=7200)
    config_key: str = Field(default="custom", max_length=80, pattern=r"^[a-z0-9_\-]+$")


class AttemptIn(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=64)
    question_id: str = Field(max_length=64)
    question_type: str = Field(max_length=40)
    question_version: str = Field(default="1.0", max_length=20)
    question_seed: int = Field(ge=0)
    skill_tags: list[str] = Field(default_factory=list, max_length=8)
    submitted_answer: str = Field(max_length=64)
    is_correct: bool  # client claim; ignored for assessments
    response_us: int = Field(ge=0, le=3_600_000_000)
    attempt_number: int = Field(ge=0)


class SessionDescriptor(BaseModel):
    client_session_id: str = Field(min_length=8, max_length=64)
    trainer_type: str = Field(max_length=40)
    mode: Literal["practice", "assessment"] = "practice"
    difficulty: int = Field(ge=1, le=10)
    seed: int = Field(ge=0)
    question_count: int | None = None
    duration_limit_s: int | None = None
    config_key: str = Field(default="", max_length=80)
    started_at: datetime | None = None


class AttemptBatchIn(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=80)
    session: SessionDescriptor
    attempts: list[AttemptIn] = Field(max_length=500)
    complete: bool = False
    duration_us: int | None = Field(default=None, ge=0)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    trainer_type: str
    mode: str
    config_key: str
    difficulty: int
    seed: int
    started_at: datetime
    completed_at: datetime | None
    total_attempts: int
    correct_attempts: int
    accuracy: float | None
    average_response_us: int | None
    median_response_us: int | None
    p90_response_us: int | None
    score: int | None
    session_status: str
    server_validated: bool


class GameEventIn(BaseModel):
    sequence_number: int = Field(ge=0)
    event_type: str = Field(max_length=40)
    event_payload: dict[str, Any] = Field(default_factory=dict)
    event_timestamp: float = Field(ge=0)


class GameSessionIn(BaseModel):
    client_session_id: str = Field(min_length=8, max_length=64)
    difficulty: int = Field(ge=1, le=10)
    seed: int = Field(ge=0)
    engine_version: str = "1.0"
    initial_state: dict[str, Any] = Field(default_factory=dict)


class GameCompleteIn(BaseModel):
    events: list[GameEventIn] = Field(default_factory=list, max_length=5000)
    final_state: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    score: float | None = None
    realised_pnl: str | None = None
    mark_to_market_pnl: str | None = None

    @field_validator("realised_pnl", "mark_to_market_pnl")
    @classmethod
    def decimal_string(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from decimal import Decimal, InvalidOperation

        try:
            Decimal(v)
        except InvalidOperation as exc:
            raise ValueError("must be a decimal string") from exc
        return v
