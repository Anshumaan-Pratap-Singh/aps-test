"""Fraction <-> decimal / percentage recognition generators."""

from __future__ import annotations

import math
import random
from fractions import Fraction

from .base import GeneratedQuestion, fmt, is_terminating

_EASY_DENS = [2, 4, 5, 8, 10, 20, 25]
_MID_DENS = [3, 6, 8, 12, 16, 40, 50]
_HARD_DENS = [7, 9, 11, 13, 16, 32, 40, 80, 125]


def _rand_fraction(rng: random.Random, d: int) -> Fraction:
    pool = _EASY_DENS if d <= 3 else _EASY_DENS + _MID_DENS if d <= 6 else _MID_DENS + _HARD_DENS
    den = rng.choice(pool)
    num = rng.randint(1, den - 1)
    while math.gcd(num, den) != 1:
        num = rng.randint(1, den - 1)
    return Fraction(num, den)


def _recurring(fr: Fraction, places: int = 4) -> str:
    """Decimal string rounded to `places`, used for non-terminating fractions."""
    return f"{fr.numerator / fr.denominator:.{places}f}"


def gen_fraction_conversion(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    kind = rng.choice(["to_pct", "to_dec", "from_dec", "simplify", "compare"] if d >= 3 else ["to_pct", "to_dec"])
    fr = _rand_fraction(rng, d)
    tex = rf"\frac{{{fr.numerator}}}{{{fr.denominator}}}"
    if kind in ("to_pct", "to_dec"):
        target = fr * 100 if kind == "to_pct" else fr
        unit = r"\%" if kind == "to_pct" else ""
        if is_terminating(fr):
            return GeneratedQuestion(
                question_type="fraction_conversion", difficulty=d, seed=seed,
                prompt_latex=rf"{tex} = ?{unit}", input_type="numeric", answer=target, answer_display=fmt(target),
                skill_tags=("fractions", "percentages" if unit else "decimals"),
                hint_steps=(rf"Scale the denominator to a power of 10: ${fr.denominator}$ divides "
                            rf"${10 ** _pow10(fr.denominator)}$.",),
                solution_steps=(rf"{tex} = {fmt(target)}{unit}",),
            )
        # Recurring: accept 2-dp answers within half a unit in the last place.
        tol = Fraction(1, 200) / abs(target) if target else Fraction(0)
        return GeneratedQuestion(
            question_type="fraction_conversion", difficulty=d, seed=seed,
            prompt_latex=rf"{tex} = ?{unit} \quad (\text{{2 d.p.}})", input_type="numeric", answer=target,
            answer_display=f"{float(target):.2f}", rel_tolerance=tol, skill_tags=("fractions", "recurring_decimals"),
            hint_steps=(rf"Recall $1/{fr.denominator}$ and multiply by {fr.numerator}.",),
            solution_steps=(rf"{tex} = {_recurring(target, 4)}\ldots{unit}",),
        )
    if kind == "from_dec":
        fr = Fraction(rng.choice([1, 3, 5, 7, 9, 11, 13, 15]), rng.choice([8, 16, 40, 20])) if d >= 5 else Fraction(rng.choice([1, 3]), rng.choice([4, 8, 5]))
        if fr >= 1:
            fr = fr - int(fr)
        if fr == 0:
            fr = Fraction(3, 8)
        return GeneratedQuestion(
            question_type="fraction_conversion", difficulty=d, seed=seed,
            prompt_latex=rf"{fmt(fr)} = \frac{{?}}{{{fr.denominator}}}", input_type="numeric",
            answer=Fraction(fr.numerator), answer_display=str(fr.numerator), skill_tags=("fractions", "decimals"),
            solution_steps=(rf"{fmt(fr)} = \frac{{{fr.numerator}}}{{{fr.denominator}}}",),
        )
    if kind == "simplify":
        k = rng.randint(2, 9)
        tex2 = rf"\frac{{{fr.numerator * k}}}{{{fr.denominator * k}}}"
        return GeneratedQuestion(
            question_type="fraction_conversion", difficulty=d, seed=seed,
            prompt_latex=rf"\text{{Simplify }} {tex2}", input_type="fraction", answer=fr,
            answer_display=f"{fr.numerator}/{fr.denominator}", skill_tags=("fractions", "simplification"),
            hint_steps=(f"Find the gcd of {fr.numerator * k} and {fr.denominator * k}.",),
            solution_steps=(f"gcd = {k}", rf"{tex2} = {tex}",),
        )
    # compare
    other = _rand_fraction(rng, d)
    while other == fr:
        other = _rand_fraction(rng, d)
    tex_o = rf"\frac{{{other.numerator}}}{{{other.denominator}}}"
    ans = "A" if fr > other else "B"
    return GeneratedQuestion(
        question_type="fraction_conversion", difficulty=d, seed=seed,
        prompt_latex=rf"\text{{Which is larger? }} A = {tex} \quad B = {tex_o}", input_type="choice",
        choices=("A", "B"), answer=ans, answer_display=ans, skill_tags=("fractions", "comparison"),
        hint_steps=("Cross-multiply.",),
        solution_steps=(rf"{fr.numerator}\times{other.denominator} = {fr.numerator * other.denominator}, "
                        rf"{other.numerator}\times{fr.denominator} = {other.numerator * fr.denominator}",),
    )


def _pow10(den: int) -> int:
    k = 0
    while (10**k) % den:
        k += 1
        if k > 12:
            return 0
    return k


def verify_fraction(q: GeneratedQuestion) -> bool:
    return q.check(q.answer_display)
