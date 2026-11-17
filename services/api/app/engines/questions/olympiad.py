"""Parameterised competition-style problems (AIME-flavoured).

Every template computes the answer with a closed form or DP *and* with a
brute-force search; the verifier requires agreement. These are computational
problems with integer answers. Proof-style problems belong in the curated,
human-reviewed problem bank, not in a random generator.
"""

from __future__ import annotations

import itertools
import math
import random
from fractions import Fraction

from .base import GeneratedQuestion


def _mk(d: int, seed: int, prompt: str, ans: int, brute: int, tags: tuple[str, ...],
        hints: tuple[str, str, str], solution: tuple[str, ...]) -> GeneratedQuestion:
    return GeneratedQuestion(question_type="olympiad", difficulty=d, seed=seed, prompt_latex=prompt,
                             input_type="numeric", answer=Fraction(ans), answer_display=str(ans), skill_tags=tags,
                             hint_steps=hints, solution_steps=solution + (f"enum:{ans == brute}",))


def p_bounded_compositions(rng, d, seed):
    n, k, cap = rng.randint(8, 12 + d), 3, rng.randint(4, 7)
    closed = sum((-1) ** j * math.comb(k, j) * math.comb(n - j * (cap + 1) + k - 1, k - 1)
                 for j in range(k + 1) if n - j * (cap + 1) >= 0)
    brute = sum(1 for t in itertools.product(range(cap + 1), repeat=k) if sum(t) == n)
    return _mk(d, seed, rf"\text{{How many ordered triples of integers }} 0 \le x,y,z \le {cap} \text{{ satisfy }} x+y+z={n}?",
               closed, brute, ("combinatorics", "inclusion_exclusion"),
               ("Without the upper bound this is stars and bars.",
                rf"Use inclusion–exclusion on the events $x \ge {cap + 1}$ etc.",
                rf"Subtract $\binom{{3}}{{1}}\binom{{{n - cap - 1}+2}}{{2}}$ and add back pairwise overlaps."),
               (rf"\sum_j (-1)^j \binom{{3}}{{j}}\binom{{{n} - {cap + 1}j + 2}}{{2}} = {closed}",))


def p_last_digits(rng, d, seed):
    a, e = rng.choice([3, 7, 13, 17, 19, 23]), rng.randint(50, 2000)
    m = 100 if d >= 5 else 10
    closed = pow(a, e, m)
    # brute: cycle detection
    seen, x, seq = {}, 1, []
    for i in range(1000):
        if x in seen:
            break
        seen[x] = i
        seq.append(x)
        x = x * a % m
    start = seen[x]
    cyc = seq[start:]
    brute = seq[e] if e < len(seq) else cyc[(e - start) % len(cyc)]
    return _mk(d, seed, rf"\text{{Find }} {a}^{{{e}}} \bmod {m}.", closed, brute, ("number_theory", "modular_arithmetic"),
               ("Powers modulo m are eventually periodic.", "Euler's theorem: $a^{\\varphi(m)} \\equiv 1$ for gcd(a,m)=1.",
                rf"$\varphi({m}) = {_phi(m)}$, so reduce the exponent modulo the order of {a}."),
               (rf"{a}^{{{e}}} \equiv {closed} \pmod{{{m}}}",))


def _phi(m: int) -> int:
    return sum(1 for k in range(1, m + 1) if math.gcd(k, m) == 1)


def p_partitions(rng, d, seed):
    n = rng.randint(6, 10 + d)
    dp = [1] + [0] * n
    for part in range(1, n + 1):
        for s in range(part, n + 1):
            dp[s] += dp[s - part]

    def brute(n: int, mx: int) -> int:
        if n == 0:
            return 1
        return sum(brute(n - k, k) for k in range(1, min(n, mx) + 1))

    return _mk(d, seed, rf"\text{{In how many ways can {n} be written as a sum of positive integers, ignoring order?}}",
               dp[n], brute(n, n), ("combinatorics", "integer_partitions"),
               ("Order does not matter: count non-increasing sequences.", "Let $p(n,k)$ count partitions with parts at most $k$.",
                "$p(n,k) = p(n,k-1) + p(n-k,k)$."), (rf"p({n}) = {dp[n]}",))


def p_diophantine(rng, d, seed):
    a, b = rng.choice([(3, 5), (4, 7), (5, 8), (6, 11), (7, 9)])
    c = rng.randint(60, 200 + 20 * d)
    brute = sum(1 for x in range(1, c) for y in range(1, c) if a * x + b * y == c)
    # closed: count via one parametrisation
    closed = 0
    for x in range(1, c // a + 1):
        if (c - a * x) > 0 and (c - a * x) % b == 0:
            closed += 1
    return _mk(d, seed, rf"\text{{How many pairs of positive integers }} (x,y) \text{{ satisfy }} {a}x + {b}y = {c}?",
               closed, brute, ("number_theory", "diophantine"),
               (rf"gcd({a},{b}) = 1, so solutions exist and are spaced regularly.",
                rf"Find one solution, then the general solution $x = x_0 + {b}t,\ y = y_0 - {a}t$.",
                "Count integer t keeping both coordinates positive."), (f"Count = {closed}",))


def p_tilings(rng, d, seed):
    n = rng.randint(6, 10 + d)
    kind = rng.choice(["1x2", "1x3"])
    if kind == "1x2":
        f = [1, 1]
        for i in range(2, n + 1):
            f.append(f[-1] + f[-2])
        closed = f[n]
        prompt = rf"\text{{Number of ways to tile a }} 2\times{n} \text{{ board with }} 1\times2 \text{{ dominoes}}?"
        hints = ("Look at how the leftmost column is covered.", "Either one vertical domino or two stacked horizontals.",
                 "$T_n = T_{n-1} + T_{n-2}$.")
        brute = _brute_compositions(n, (1, 2))
    else:
        f = [1, 1, 1]
        for i in range(3, n + 1):
            f.append(f[-1] + f[-3])
        closed = f[n]
        prompt = rf"\text{{Number of ways to write {n} as an ordered sum of 1s and 3s}}?"
        hints = ("Condition on the first summand.", "It is 1 or 3.", "$a_n = a_{n-1} + a_{n-3}$.")
        brute = _brute_compositions(n, (1, 3))
    return _mk(d, seed, prompt, closed, brute, ("combinatorics", "recurrences"), hints, (f"Answer = {closed}",))


def _brute_compositions(n: int, parts: tuple[int, ...]) -> int:
    if n == 0:
        return 1
    return sum(_brute_compositions(n - p, parts) for p in parts if p <= n)


def p_derangements(rng, d, seed):
    n = rng.randint(4, 7)
    closed = round(math.factorial(n) * sum(Fraction((-1) ** k, math.factorial(k)) for k in range(n + 1)))
    brute = sum(1 for p in itertools.permutations(range(n)) if all(p[i] != i for i in range(n)))
    return _mk(d, seed, rf"\text{{{n} letters go into {n} addressed envelopes at random. How many arrangements put no letter in its own envelope?}}",
               closed, brute, ("combinatorics", "inclusion_exclusion"),
               ("Count the complement: at least one letter correct.", "Inclusion–exclusion over sets of fixed letters.",
                r"$D_n = n!\sum_{k=0}^n (-1)^k/k!$."), (rf"D_{{{n}}} = {closed}",))


TEMPLATES = {
    "bounded_compositions": (p_bounded_compositions, 3),
    "last_digits": (p_last_digits, 2),
    "partitions": (p_partitions, 4),
    "diophantine": (p_diophantine, 3),
    "tilings": (p_tilings, 2),
    "derangements": (p_derangements, 4),
}


def gen_olympiad(rng: random.Random, d: int, seed: int, template: str | None = None) -> GeneratedQuestion:
    eligible = [k for k, (_, m) in TEMPLATES.items() if m <= d] or ["tilings"]
    key = template if template in TEMPLATES else rng.choice(eligible)
    return TEMPLATES[key][0](rng, d, seed)


def verify_olympiad(q: GeneratedQuestion) -> bool:
    return all(s == "enum:True" for s in q.solution_steps if s.startswith("enum:"))
