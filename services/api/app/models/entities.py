"""SQLAlchemy ORM models.

Conventions:
  * UUID primary keys (server-generated in Python).
  * Response times stored as BIGINT microseconds (``*_us``).
  * Money stored as NUMERIC(18, 6). Never compare floats for money.
  * ``client_event_id`` UNIQUE columns give idempotent uploads.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    external_identity: Mapped[str | None] = mapped_column(String(255), unique=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    account_status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    __table_args__ = (CheckConstraint("account_status in ('active','suspended','deleted')", name="ck_users_status"),)


class RoleTrack(TimestampMixin, Base):
    __tablename__ = "role_tracks"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)  # e.g. 'trader'
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    sections: Mapped[list[TrackSection]] = relationship(back_populates="track", order_by="TrackSection.display_order")


class TrackSection(Base):
    __tablename__ = "track_sections"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    role_track_id: Mapped[str] = mapped_column(ForeignKey("role_tracks.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    track: Mapped[RoleTrack] = relationship(back_populates="sections")
    items: Mapped[list[ContentItem]] = relationship(back_populates="section")
    __table_args__ = (UniqueConstraint("role_track_id", "display_order", name="uq_section_order"),)


class ContentItem(Base):
    __tablename__ = "content_items"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    section_id: Mapped[str] = mapped_column(ForeignKey("track_sections.id", ondelete="CASCADE"), index=True)
    content_type: Mapped[str] = mapped_column(String(30))  # lesson | trainer | game | lab | assessment
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    estimated_duration: Mapped[int] = mapped_column(Integer, default=10)  # minutes
    content_version: Mapped[str] = mapped_column(String(20), default="1.0")
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    section: Mapped[TrackSection] = relationship(back_populates="items")
    __table_args__ = (CheckConstraint("difficulty between 1 and 10", name="ck_content_difficulty"),)


class UserTrackProgress(Base):
    __tablename__ = "user_track_progress"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content_item_id: Mapped[str] = mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    completion_percentage: Mapped[float] = mapped_column(Float, default=0)
    best_score: Mapped[float | None] = mapped_column(Float)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("user_id", "content_item_id", name="uq_progress_user_item"),
                      CheckConstraint("completion_percentage between 0 and 100", name="ck_progress_pct"))


class TrainingSession(Base):
    __tablename__ = "training_sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    trainer_type: Mapped[str] = mapped_column(String(40))
    mode: Mapped[str] = mapped_column(String(20), default="practice")  # practice | assessment
    config_key: Mapped[str] = mapped_column(String(80), default="")  # assessment preset, for cohorting
    difficulty: Mapped[int] = mapped_column(Integer)
    question_count: Mapped[int | None] = mapped_column(Integer)
    duration_limit_s: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    seed: Mapped[int] = mapped_column(BigInteger)
    generator_version: Mapped[str] = mapped_column(String(20), default="1.0")
    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct_attempts: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float | None] = mapped_column(Float)
    average_response_us: Mapped[int | None] = mapped_column(BigInteger)
    median_response_us: Mapped[int | None] = mapped_column(BigInteger)
    p90_response_us: Mapped[int | None] = mapped_column(BigInteger)
    score: Mapped[int | None] = mapped_column(Integer)
    session_status: Mapped[str] = mapped_column(String(20), default="active")
    server_validated: Mapped[bool] = mapped_column(Boolean, default=False)
    client_session_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    attempts: Mapped[list[QuestionAttempt]] = relationship(back_populates="session", cascade="all, delete-orphan")
    __table_args__ = (
        Index("ix_sessions_user_started", "user_id", "started_at"),
        Index("ix_sessions_cohort", "trainer_type", "difficulty", "mode", "config_key", "completed_at"),
        CheckConstraint("session_status in ('active','completed','abandoned')", name="ck_session_status"),
        CheckConstraint("difficulty between 1 and 10", name="ck_session_difficulty"),
    )


class QuestionAttempt(Base):
    __tablename__ = "question_attempts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id", ondelete="CASCADE"))
    client_event_id: Mapped[str] = mapped_column(String(64), unique=True)
    question_id: Mapped[str] = mapped_column(String(64))
    question_type: Mapped[str] = mapped_column(String(40))
    question_version: Mapped[str] = mapped_column(String(20), default="1.0")
    question_seed: Mapped[int] = mapped_column(BigInteger)
    skill_tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    submitted_answer: Mapped[str] = mapped_column(String(64))
    is_correct: Mapped[bool] = mapped_column(Boolean)
    response_us: Mapped[int] = mapped_column(BigInteger)
    attempt_number: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    session: Mapped[TrainingSession] = relationship(back_populates="attempts")
    __table_args__ = (Index("ix_attempts_session_num", "session_id", "attempt_number"),
                      CheckConstraint("response_us >= 0", name="ck_attempt_rt"))


class UserSkillMastery(Base):
    __tablename__ = "user_skill_mastery"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    skill_tag: Mapped[str] = mapped_column(String(60))
    mastery_score: Mapped[float] = mapped_column(Float, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct_attempts: Mapped[int] = mapped_column(Integer, default=0)
    ease: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[float] = mapped_column(Float, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_practised_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint("user_id", "skill_tag", name="uq_mastery_user_skill"),)


class GameSession(Base):
    __tablename__ = "game_sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    client_session_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    game_type: Mapped[str] = mapped_column(String(40))
    difficulty: Mapped[int] = mapped_column(Integer)
    seed: Mapped[int] = mapped_column(BigInteger)
    engine_version: Mapped[str] = mapped_column(String(20), default="1.0")
    initial_state: Mapped[dict] = mapped_column(JSONB, default=dict)
    final_state: Mapped[dict | None] = mapped_column(JSONB)
    metrics: Mapped[dict | None] = mapped_column(JSONB)
    score: Mapped[float | None] = mapped_column(Float)
    realised_pnl: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    mark_to_market_pnl: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    events: Mapped[list[GameEvent]] = relationship(back_populates="game_session", cascade="all, delete-orphan",
                                                   order_by="GameEvent.sequence_number")
    __table_args__ = (Index("ix_games_user_type", "user_id", "game_type", "started_at"),)


class GameEvent(Base):
    __tablename__ = "game_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    game_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("game_sessions.id", ondelete="CASCADE"))
    sequence_number: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(40))
    event_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    event_timestamp: Mapped[float] = mapped_column(Float)  # ms since session start (performance.now delta)
    game_session: Mapped[GameSession] = relationship(back_populates="events")
    __table_args__ = (UniqueConstraint("game_session_id", "sequence_number", name="uq_game_event_seq"),)


class BenchmarkSnapshot(Base):
    __tablename__ = "benchmark_snapshots"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    cohort_key: Mapped[str] = mapped_column(String(200), index=True)
    trainer_type: Mapped[str] = mapped_column(String(40))
    difficulty: Mapped[int] = mapped_column(Integer)
    benchmark_period: Mapped[str] = mapped_column(String(20))
    metric: Mapped[str] = mapped_column(String(40))
    p10: Mapped[float | None] = mapped_column(Float)
    p25: Mapped[float | None] = mapped_column(Float)
    p50: Mapped[float | None] = mapped_column(Float)
    p75: Mapped[float | None] = mapped_column(Float)
    p90: Mapped[float | None] = mapped_column(Float)
    sample_size: Mapped[int] = mapped_column(Integer)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IdempotencyKey(Base):
    """Records processed batch-upload keys so retries are no-ops."""

    __tablename__ = "idempotency_keys"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    response: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
