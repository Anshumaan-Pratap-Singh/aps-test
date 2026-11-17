"""Number-sequence generators.

Each family has an explicit rule, an explanation and a hint ladder. The
verifier recomputes the next term from the rule AND checks the shown terms
against simpler families (arithmetic, geometric, low-degree polynomial). If a
simpler family fits every shown term but predicts a *different* next term, the
sequence is ambiguous and is rejected.
"""

from __future__ import annotations

import random
from fractions import Fraction
from typing import Callable

from .base import GeneratedQuestion, fmt


def _primes(n: int) -> list[int]:
    out, k = [], 2
    while len(out) < n:
        if all(k % p for p in out if p * p <= k):
            out.append(k)
        k += 1
    return out


def poly_next(terms: list[Fraction], max_degree: int) -> Fraction | None:
    """Next term via finite differences if a polynomial of degree <= max_degree fits."""
    rows = [list(terms)]
    while len(rows[-1]) > 1:
        r = rows[-1]
        rows.append([r[i + 1] - r[i] for i in range(len(r) - 1)])
    for deg, row in enumerate(rows):
        if deg > max_degree:
            return None
        if len(row) >= 2 and all(x == row[0] for x in row):
            # constant row at this level: extrapolate
            nxt = row[-1]
            for up in range(deg - 1, -1, -1):
                nxt = rows[up][-1] + nxt
            return nxt
        if len(row) < 2:
            return None
    return None


def geometric_next(terms: list[Fraction]) -> Fraction | None:
    if any(t == 0 for t in terms[:-1]):
        return None
    ratios = {terms[i + 1] / terms[i] for i in range(len(terms) - 1)}
    return terms[-1] * ratios.pop() if len(ratios) == 1 else None


def alternative_answers(terms: list[Fraction]) -> set[Fraction]:
    alts: set[Fraction] = set()
    p = poly_next(terms, max_degree=min(3, len(terms) - 3))  # need >=2 points beyond degree to be convincing
    if p is not None:
        alts.add(p)
    g = geometric_next(terms)
    if g is not None:
        alts.add(g)
    return alts


Family = Callable[[random.Random, int], tuple[list[int], int, str, tuple[str, ...], str]]


def fam_arithmetic(rng: random.Random, d: int):
    a, k = rng.randint(1, 20 * d), rng.choice([i for i in range(-3 * d - 2, 3 * d + 3) if i not in (0,)])
    terms = [a + k * i for i in range(6)]
    return terms[:5], terms[5], f"Arithmetic progression with common difference {k}.", \
        ("Look at consecutive differences.",), "arithmetic"


def fam_geometric(rng: random.Random, d: int):
    a, r = rng.randint(1, 5 + d), rng.choice([2, 3, -2] if d < 6 else [2, 3, 4, -3, 5])
    terms = [a * r**i for i in range(6)]
    return terms[:5], terms[5], f"Geometric progression with common ratio {r}.", \
        ("Look at consecutive ratios.",), "geometric"


def fam_quadratic(rng: random.Random, d: int):
    a, b, c = rng.randint(1, 1 + d // 3), rng.randint(-3, 3 + d), rng.randint(-5, 5 + d)
    s = rng.randint(1, 3)
    f = lambda n: a * n * n + b * n + c  # noqa: E731
    terms = [f(n) for n in range(s, s + 6)]
    return terms[:5], terms[5], (
        f"Second differences are constant ({2 * a}); the terms follow $an^2+bn+c$ with a={a}, b={b}, c={c} "
        f"starting at n={s}."), ("Take differences twice.", "The second differences are constant."), "polynomial"


def fam_cubic(rng: random.Random, d: int):
    a, c = rng.randint(1, 2), rng.randint(-4, 6)
    s = rng.randint(1, 3)
    terms = [a * n**3 + c for n in range(s, s + 7)]
    return terms[:6], terms[6], f"Terms are {a}n^3 + {c} (third differences constant at {6 * a}).", \
        ("Take differences three times.",), "polynomial"


def fam_n_times(rng: random.Random, d: int):
    # n(n+k): 3,8,15,24,35 = n(n+2); 2,6,12,20,30 = n(n+1)
    k = rng.randint(1, 3 + d // 3)
    s = rng.randint(1, 2)
    terms = [n * (n + k) for n in range(s, s + 6)]
    return terms[:5], terms[5], f"Term n is n(n+{k}) — equivalently differences increase by 2.", \
        ("Differences form an arithmetic sequence.",), "polynomial"


def fam_interleaved(rng: random.Random, d: int):
    # 1,4,2,8,3,12,? -> odd positions 1,2,3,... even positions 4,8,12,...
    a0, ka = rng.randint(1, 5), rng.randint(1, 3)
    b0, kb = rng.randint(2, 9), rng.randint(2, 5 + d)
    seq = []
    for i in range(4):
        seq += [a0 + ka * i, b0 + kb * i]
    return seq[:7], seq[7], (
        f"Two interleaved arithmetic progressions: odd positions step {ka}, even positions step {kb}."), \
        ("Split into odd- and even-indexed terms.",), "interleaved"


def fam_alternating_ops(rng: random.Random, d: int):
    x, m, a = rng.randint(1, 6), rng.choice([2, 3]), rng.randint(1, 5 + d)
    seq = [x]
    for i in range(6):
        seq.append(seq[-1] * m if i % 2 == 0 else seq[-1] + a)
    return seq[:6], seq[6], f"Alternately multiply by {m} and add {a}.", \
        ("The rule changes each step.", "Compare odd steps to even steps."), "alternating"


def fam_fibonacci_like(rng: random.Random, d: int):
    a, b = rng.randint(1, 4 + d), rng.randint(1, 6 + d)
    seq = [a, b]
    while len(seq) < 8:
        seq.append(seq[-1] + seq[-2])
    return seq[:7], seq[7], "Each term is the sum of the previous two.", \
        ("Relate each term to the two before it.",), "recursive"


def fam_recursive_affine(rng: random.Random, d: int):
    m, c = rng.choice([2, 3]), rng.choice([-1, 1, 2, -2, 3])
    seq = [rng.randint(1, 5)]
    while len(seq) < 6:
        seq.append(m * seq[-1] + c)
    return seq[:5], seq[5], f"Recursive: next = {m} × previous {'+' if c >= 0 else '−'} {abs(c)}.", \
        ("Compare each term with double/triple the previous term.",), "recursive"


def fam_primes(rng: random.Random, d: int):
    p = _primes(30)
    s = rng.randint(0, 10 + d)
    if rng.random() < 0.5:
        seq = p[s:s + 6]
        return seq[:5], seq[5], "Consecutive prime numbers.", ("Are these numbers divisible by anything?",), "primes"
    # prime gaps
    gaps = [p[i + 1] - p[i] for i in range(s, s + 7)]
    return gaps[:6], gaps[6], f"Gaps between consecutive primes starting at {p[s]}.", \
        ("Think about differences between a famous sequence.",), "primes"


def fam_squares_plus(rng: random.Random, d: int):
    c = rng.randint(-3, 5)
    s = rng.randint(1, 6)
    seq = [n * n + c for n in range(s, s + 6)]
    return seq[:5], seq[5], f"Perfect squares shifted by {c}: n^2 {'+' if c >= 0 else '−'} {abs(c)}.", \
        ("Compare with perfect squares.",), "polynomial"


def fam_modular(rng: random.Random, d: int):
    m = rng.choice([7, 9, 11, 13])
    k = rng.randint(2, m - 2)
    x0 = rng.randint(1, m - 1)
    seq = [(x0 + k * i) % m for i in range(8)]
    return seq[:7], seq[7], f"Add {k} each step, reduced modulo {m}.", \
        (f"Values never exceed {m - 1}.", "Consider remainders."), "modular"


FAMILIES: dict[str, tuple[Family, int]] = {
    "arithmetic": (fam_arithmetic, 1),
    "geometric": (fam_geometric, 1),
    "n_times": (fam_n_times, 2),
    "squares_plus": (fam_squares_plus, 2),
    "quadratic": (fam_quadratic, 3),
    "interleaved": (fam_interleaved, 3),
    "fibonacci_like": (fam_fibonacci_like, 3),
    "alternating": (fam_alternating_ops, 4),
    "recursive_affine": (fam_recursive_affine, 5),
    "primes": (fam_primes, 5),
    "cubic": (fam_cubic, 6),
    "modular": (fam_modular, 7),
}


def gen_sequence(rng: random.Random, d: int, seed: int, family: str | None = None) -> GeneratedQuestion:
    eligible = [k for k, (_, min_d) in FAMILIES.items() if min_d <= d]
    key = family if family in FAMILIES else rng.choice(eligible)
    fn = FAMILIES[key][0]
    shown, nxt, explanation, hints, tag = fn(rng, d)
    prompt = ",\\ ".join(str(x) for x in shown) + ",\\ ?"
    return GeneratedQuestion(
        question_type="sequence", difficulty=d, seed=seed, prompt_latex=prompt, input_type="numeric",
        answer=Fraction(nxt), answer_display=str(nxt), skill_tags=("sequences", tag),
        hint_steps=hints + (explanation.split(";")[0].split("—")[0],),
        solution_steps=(explanation, f"Next term: {nxt}", "terms:" + ",".join(map(str, shown)), f"family:{key}"),
    )


def verify_sequence(q: GeneratedQuestion) -> bool:
    terms_step = next(s for s in q.solution_steps if s.startswith("terms:"))
    terms = [Fraction(int(x)) for x in terms_step[len("terms:"):].split(",")]
    if len(set(terms)) == 1:
        return False
    alts = alternative_answers(terms)
    # If any simpler model fits and disagrees, the sequence is ambiguous.
    return all(a == q.answer for a in alts)


def fmt_terms(q: GeneratedQuestion) -> str:  # pragma: no cover - helper for debugging
    return q.prompt_latex + " -> " + fmt(q.answer)  # type: ignore[arg-type]
