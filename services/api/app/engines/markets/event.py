"""Bayesian event-probability updates for binary event contracts.

A signal with reliability r in (0.5, 1) is a noisy report of the true outcome:
P(signal says YES | YES) = r, P(signal says YES | NO) = 1 - r.
Likelihood ratio for a YES signal is LR = r / (1 - r).

    logit(posterior) = logit(prior) + direction * log(LR)

Probabilities are clamped to [eps, 1 - eps] so prices remain valid.
We also provide an exact Fraction version for test oracles.
"""

from __future__ import annotations

import math
from fractions import Fraction

EPS = 1e-4


def clamp_prob(p: float, eps: float = EPS) -> float:
    if math.isnan(p):
        raise ValueError("probability is NaN")
    return min(1 - eps, max(eps, p))


def logit(p: float) -> float:
    p = clamp_prob(p)
    return math.log(p / (1 - p))


def sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1 / (1 + z)
    z = math.exp(x)
    return z / (1 + z)


def update(prior: float, reliability: float, says_yes: bool) -> float:
    if not (0.5 <= reliability < 1):
        raise ValueError("reliability must be in [0.5, 1)")
    lr = math.log(reliability / (1 - reliability))
    return clamp_prob(sigmoid(logit(prior) + (lr if says_yes else -lr)))


def update_exact(prior: Fraction, reliability: Fraction, says_yes: bool) -> Fraction:
    like_yes = reliability if says_yes else 1 - reliability
    like_no = 1 - reliability if says_yes else reliability
    return like_yes * prior / (like_yes * prior + like_no * (1 - prior))


def binary_contract_quote(fair_prob: float, uncertainty: float, toxicity: float, inventory: int,
                          payout: float = 100.0, risk_aversion: float = 0.5, tick: float = 1.0,
                          base_half: float = 1.0) -> tuple[float, float]:
    """Bid/ask in price terms (0..payout). Width grows with uncertainty and toxicity;
    the centre shifts against inventory. Result is clamped to [tick, payout - tick]."""
    fv = clamp_prob(fair_prob) * payout
    half = base_half + payout * (0.5 * uncertainty + 0.5 * toxicity * uncertainty)
    centre = fv - risk_aversion * inventory
    bid = math.floor((centre - half) / tick) * tick
    ask = math.ceil((centre + half) / tick) * tick
    bid = max(0.0, min(payout - tick, bid))
    ask = min(payout, max(bid + tick, ask))
    return bid, ask
