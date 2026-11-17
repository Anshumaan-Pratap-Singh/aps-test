"""Session statistics, computed from the answer history only (single source of truth)."""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass


@dataclass(frozen=True)
class SessionStats:
    attempts: int
    correct: int
    incorrect: int
    accuracy: float
    mean_us: int | None
    median_us: int | None
    p90_us: int | None
    fastest_correct_us: int | None
    best_streak: int
    net_score: int
    qpm: float


def percentile_nearest_rank(values: list[int], p: float) -> int:
    s = sorted(values)
    k = max(1, math.ceil(p * len(s)))
    return s[k - 1]


def compute(correct_flags: list[bool], response_us: list[int], duration_us: int | None = None,
            penalty: int = 1) -> SessionStats:
    n = len(correct_flags)
    c = sum(correct_flags)
    best = cur = 0
    for ok in correct_flags:
        cur = cur + 1 if ok else 0
        best = max(best, cur)
    correct_rts = [rt for rt, ok in zip(response_us, correct_flags) if ok]
    dur = duration_us if duration_us is not None else sum(response_us)
    return SessionStats(
        attempts=n, correct=c, incorrect=n - c, accuracy=(c / n) if n else 0.0,
        mean_us=round(statistics.fmean(response_us)) if response_us else None,
        median_us=round(statistics.median(response_us)) if response_us else None,
        p90_us=percentile_nearest_rank(response_us, 0.9) if response_us else None,
        fastest_correct_us=min(correct_rts) if correct_rts else None,
        best_streak=best, net_score=c - penalty * (n - c),
        qpm=(n / (dur / 60_000_000)) if dur else 0.0,
    )
