"""Proper scoring rules and betting maths.

Interval score (Gneiting & Raftery 2007) for a central (1 - alpha) interval [l, u]:

    IS_alpha(l, u; x) = (u - l) + (2/alpha)(l - x) 1{x < l} + (2/alpha)(x - u) 1{x > u}

It is a proper scoring rule: expected score is minimised by reporting the true
alpha/2 and 1 - alpha/2 quantiles, so widening intervals is *not* rewarded.
Fermi quantities span orders of magnitude, so we apply it to log10 values.
"""

from __future__ import annotations

import math


def interval_score(lower: float, upper: float, truth: float, alpha: float) -> float:
    if not (0 < alpha < 1):
        raise ValueError("alpha in (0,1)")
    if upper < lower:
        raise ValueError("upper < lower")
    s = upper - lower
    if truth < lower:
        s += (2 / alpha) * (lower - truth)
    elif truth > upper:
        s += (2 / alpha) * (truth - upper)
    return s


def fermi_score(point: float, lower: float, upper: float, truth: float, confidence: float = 0.8,
                seconds: float | None = None, time_limit: float = 60.0) -> dict:
    """Score a Fermi estimate on a log10 scale. Returns components and a 0-100 composite.

    composite = 100 * exp(-IS_log / 2) * speed_factor; speed_factor in [0.8, 1].
    """
    if min(point, lower, upper, truth) <= 0:
        raise ValueError("Fermi quantities must be positive")
    lo, hi, x, pt = (math.log10(v) for v in (lower, upper, truth, point))
    alpha = 1 - confidence
    is_log = interval_score(lo, hi, x, alpha)
    log_err = abs(pt - x)
    speed = 1.0 if seconds is None else max(0.8, 1 - 0.2 * min(1.0, seconds / time_limit))
    composite = 100 * math.exp(-is_log / 2) * speed
    return {"interval_score_log10": is_log, "point_log10_error": log_err, "covered": lower <= truth <= upper,
            "orders_of_magnitude_width": hi - lo, "composite": composite}


def implied_probability(decimal_odds: float) -> float:
    if decimal_odds <= 1:
        raise ValueError("decimal odds must exceed 1")
    return 1 / decimal_odds


def expected_value(p: float, decimal_odds: float, stake: float = 1.0) -> float:
    """EV of a back bet: win (odds - 1)*stake w.p. p, lose stake otherwise."""
    return stake * (p * (decimal_odds - 1) - (1 - p))


def kelly_fraction(p: float, decimal_odds: float) -> float:
    """Full-Kelly fraction f* = (b p - q)/b with b = odds - 1. Never negative (no bet)."""
    b = decimal_odds - 1
    return max(0.0, (b * p - (1 - p)) / b)


def stake_size(bankroll: float, p: float, decimal_odds: float, kelly_multiplier: float = 0.5, cap: float = 0.05) -> float:
    return bankroll * min(cap, kelly_multiplier * kelly_fraction(p, decimal_odds))
