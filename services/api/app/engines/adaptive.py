"""Rule-based adaptive difficulty and spaced repetition.

Adaptive difficulty (transparent rules over a window of the last N attempts at
the current level; no change until the window is full):

  * accuracy >= 0.90 and median RT <= target RT          -> +1
  * accuracy >= 0.90 and median RT  > target RT          ->  0 (encourage speed)
  * 0.60 <= accuracy < 0.90                              ->  0
  * accuracy < 0.60                                      -> -1 (temporary step down)

Spaced repetition: SM-2-style ease/interval per skill; quality q in 0..5 from
session accuracy (q = round(5 * accuracy)). Mastery is an exponentially weighted
accuracy with a confidence discount for few attempts.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta

WINDOW = 20


@dataclass(frozen=True)
class AttemptSummary:
    correct: bool
    response_ms: float


def target_rt_ms(difficulty: int) -> float:
    return 2500 + 900 * (difficulty - 1)


def next_difficulty(current: int, recent: list[AttemptSummary]) -> tuple[int, str]:
    if len(recent) < WINDOW:
        return current, f"Need {WINDOW - len(recent)} more attempts at this level before adapting."
    window = recent[-WINDOW:]
    acc = sum(a.correct for a in window) / WINDOW
    med = statistics.median(a.response_ms for a in window if a.correct) if any(a.correct for a in window) else float("inf")
    tgt = target_rt_ms(current)
    if acc >= 0.9 and med <= tgt:
        return min(10, current + 1), f"Accuracy {acc:.0%} and median {med:.0f}ms ≤ {tgt:.0f}ms: level up."
    if acc >= 0.9:
        return current, f"Accurate ({acc:.0%}) but median {med:.0f}ms > {tgt:.0f}ms: hold level, push speed."
    if acc < 0.6:
        return max(1, current - 1), f"Accuracy {acc:.0%} below 60%: step down temporarily."
    return current, f"Accuracy {acc:.0%}: consolidate at this level."


@dataclass
class ReviewState:
    ease: float = 2.5
    interval_days: float = 0.0
    repetitions: int = 0
    due_at: datetime | None = None


def schedule_review(state: ReviewState, accuracy: float, now: datetime) -> ReviewState:
    q = max(0, min(5, round(5 * accuracy)))
    ease = max(1.3, state.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if q < 3:
        reps, interval = 0, 1.0 / 24 * 12  # retry in ~12 hours
    else:
        reps = state.repetitions + 1
        interval = 1.0 if reps == 1 else 3.0 if reps == 2 else state.interval_days * ease
    return ReviewState(ease=ease, interval_days=interval, repetitions=reps, due_at=now + timedelta(days=interval))


def mastery(prev: float, attempts: int, session_correct: int, session_total: int, alpha: float = 0.3) -> float:
    """EW accuracy blended toward 0 with a confidence factor n/(n+10). Range [0,1]."""
    if session_total == 0:
        return prev
    acc = session_correct / session_total
    raw = acc if attempts == 0 else (1 - alpha) * prev + alpha * acc
    return raw


def mastery_display(raw: float, attempts: int) -> float:
    return raw * attempts / (attempts + 10)
