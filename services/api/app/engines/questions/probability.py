"""Probability / expected-value problem engine.

Every template computes its answer two independent ways where feasible:
(1) a closed-form expression, (2) exhaustive enumeration over the finite
sample space (dice, coins, cards, urns). The verifier asserts agreement.
All arithmetic uses Fraction.
"""

from __future__ import annotations

import itertools
import math
import random
from fractions import Fraction

from .base import GeneratedQuestion

F = Fraction


def _frac_tex(x: Fraction) -> str:
    return str(x.numerator) if x.denominator == 1 else rf"\frac{{{x.numerator}}}{{{x.denominator}}}"


def _ans(x: Fraction) -> str:
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def _mk(qtype: str, d: int, seed: int, prompt: str, answer: Fraction, tags: tuple[str, ...],
        hints: tuple[str, ...], steps: tuple[str, ...], enum_check: Fraction | None) -> GeneratedQuestion:
    s = steps + ((f"enum:{answer == enum_check}",) if enum_check is not None else ())
    return GeneratedQuestion(question_type=qtype, difficulty=d, seed=seed, prompt_latex=prompt, input_type="fraction",
                             answer=answer, answer_display=_ans(answer), skill_tags=tags, hint_steps=hints,
                             solution_steps=s)


def t_dice_sum(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    n = 2 if d <= 4 else 3
    target = rng.randint(n + 1, 6 * n - 1)
    cmp = rng.choice(["=", r"\geq"])
    outcomes = list(itertools.product(range(1, 7), repeat=n))
    hits = sum(1 for o in outcomes if (sum(o) == target if cmp == "=" else sum(o) >= target))
    enum = F(hits, len(outcomes))
    # closed form for "=" via stars-and-bars inclusion–exclusion
    def ways_eq(t: int) -> int:
        return sum((-1) ** k * math.comb(n, k) * math.comb(t - 6 * k - 1, n - 1) for k in range(n + 1) if t - 6 * k - 1 >= n - 1)
    closed = F(ways_eq(target) if cmp == "=" else sum(ways_eq(t) for t in range(target, 6 * n + 1)), 6**n)
    return _mk("prob_dice", d, seed,
               rf"\text{{Roll {n} fair dice. }} P(\text{{sum}} {cmp} {target}) = ?", closed, ("probability", "dice", "counting"),
               (f"There are $6^{n} = {6**n}$ equally likely outcomes.",
                "Count outcomes with inclusion–exclusion on the constraint each die is at most 6."),
               (rf"\text{{Favourable outcomes}} = {hits}", rf"P = \frac{{{hits}}}{{{6**n}}} = {_frac_tex(closed)}"), enum)


def t_coins_at_least(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    n = rng.randint(3, 4 + d)
    k = rng.randint(1, n - 1)
    closed = F(sum(math.comb(n, j) for j in range(k, n + 1)), 2**n)
    enum = F(sum(1 for o in itertools.product((0, 1), repeat=n) if sum(o) >= k), 2**n)
    return _mk("prob_coins", d, seed, rf"\text{{Flip {n} fair coins. }} P(\text{{at least {k} heads}}) = ?", closed,
               ("probability", "binomial"), ("Model the count of heads as Binomial(n, 1/2).",),
               (rf"P = \sum_{{j={k}}}^{{{n}}} \binom{{{n}}}{{j}} 2^{{-{n}}} = {_frac_tex(closed)}",), enum)


def t_cards_conditional(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    # P(second card is an ace | first card is an ace), or both same suit, drawn without replacement.
    kind = rng.choice(["ace_ace", "same_suit", "at_least_one_heart"])
    deck = [(r, s) for r in range(13) for s in range(4)]
    pairs = list(itertools.permutations(deck, 2))
    if kind == "ace_ace":
        closed = F(3, 51)
        enum = F(sum(1 for a, b in pairs if a[0] == 0 and b[0] == 0), sum(1 for a, _ in pairs if a[0] == 0))
        prompt = r"\text{Two cards drawn without replacement. } P(\text{2nd is an ace} \mid \text{1st is an ace}) = ?"
        steps = (r"Given an ace was removed, 3 aces remain among 51 cards.",)
    elif kind == "same_suit":
        closed = F(12, 51)
        enum = F(sum(1 for a, b in pairs if a[1] == b[1]), len(pairs))
        prompt = r"\text{Two cards drawn without replacement. } P(\text{same suit}) = ?"
        steps = (r"Whatever the first card, 12 of the remaining 51 share its suit.",)
    else:
        closed = 1 - F(39 * 38, 52 * 51)
        enum = F(sum(1 for a, b in pairs if a[1] == 0 or b[1] == 0), len(pairs))
        prompt = r"\text{Two cards drawn without replacement. } P(\text{at least one heart}) = ?"
        steps = (r"Complement: $1 - \frac{39}{52}\cdot\frac{38}{51}$.",)
    return _mk("prob_cards", d, seed, prompt, closed, ("probability", "conditional", "cards"),
               ("Condition on the first card, or use the complement.",), steps, enum)


def t_urn(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    r, b = rng.randint(2, 4 + d), rng.randint(2, 4 + d)
    k = 2 if d < 6 else 3
    closed = F(math.comb(r, k), math.comb(r + b, k))
    balls = ["R"] * r + ["B"] * b
    combos = list(itertools.combinations(range(r + b), k))
    enum = F(sum(1 for c in combos if all(balls[i] == "R" for i in c)), len(combos))
    return _mk("prob_urn", d, seed,
               rf"\text{{An urn holds {r} red and {b} blue balls. Draw {k} without replacement. }} P(\text{{all red}}) = ?",
               closed, ("probability", "hypergeometric"), ("Count favourable subsets over all subsets.",),
               (rf"P = \binom{{{r}}}{{{k}}} \big/ \binom{{{r + b}}}{{{k}}} = {_frac_tex(closed)}",), enum)


def t_bayes(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    prior = F(rng.choice([1, 2, 5, 10]), 100)
    sens = F(rng.choice([80, 90, 95, 99]), 100)
    fpr = F(rng.choice([5, 10, 20]), 100)
    post = sens * prior / (sens * prior + fpr * (1 - prior))
    # enumeration over a population of 10000 (exact because rates are multiples of 1/100)
    N = 10000
    diseased = int(N * prior)
    tp = int(diseased * sens)
    fp = int((N - diseased) * fpr)
    enum = F(tp, tp + fp)
    return _mk("prob_bayes", d, seed,
               rf"\text{{Prevalence {prior * 100}\%, sensitivity {sens * 100}\%, false-positive rate {fpr * 100}\%. }} P(D \mid +) = ?",
               post, ("probability", "bayes"),
               ("Write Bayes' theorem: $P(D|+) = P(+|D)P(D)/P(+)$.", "Expand $P(+)$ by the law of total probability."),
               (rf"P(D\mid +) = \frac{{{_frac_tex(sens)}\cdot{_frac_tex(prior)}}}{{{_frac_tex(sens)}\cdot{_frac_tex(prior)} + {_frac_tex(fpr)}\cdot{_frac_tex(1 - prior)}}} = {_frac_tex(post)}",
                f"Natural frequencies: out of {N}, {tp} true positives and {fp} false positives."), enum)


def t_ev_max_dice(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    n = 2 if d < 5 else 3
    stat = rng.choice(["max", "min"])
    outcomes = list(itertools.product(range(1, 7), repeat=n))
    enum = F(sum(max(o) if stat == "max" else min(o) for o in outcomes), len(outcomes))
    # closed form: E[max] = sum_k P(max >= k) = sum_k (1 - ((k-1)/6)^n)
    if stat == "max":
        closed = sum((1 - F(k - 1, 6) ** n for k in range(1, 7)), F(0))
    else:
        closed = sum((F(7 - k, 6) ** n for k in range(1, 7)), F(0))
    return _mk("ev_dice", d, seed, rf"\text{{Roll {n} fair dice. }} \mathbb{{E}}[\{stat}] = ?", closed,
               ("expected_value", "dice"),
               (r"Use the tail-sum formula $\mathbb{E}[X] = \sum_{k\ge1} P(X \ge k)$.",),
               (rf"\mathbb{{E}}[\{stat}] = {_frac_tex(closed)}",), enum)


def t_ev_game(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    # Roll a die; may re-roll once (must keep second). Optimal EV.
    if d <= 3:
        closed = F(7, 2)
        prompt = r"\text{You are paid the face of one fair die roll. Fair price} = ?"
        steps = (r"$\mathbb{E} = (1+\dots+6)/6 = 7/2$.",)
        enum = F(sum(range(1, 7)), 6)
    else:
        rerolls = 1 if d < 8 else 2
        v = F(7, 2)
        for _ in range(rerolls):
            v = sum((max(F(k), v) for k in range(1, 7)), F(0)) / 6
        closed = v
        prompt = rf"\text{{Paid the face of a die; you may re-roll up to {rerolls} time(s), keeping the last roll. Optimal EV}} = ?"
        steps = (r"Backward induction: keep a roll iff it exceeds the continuation value.",
                 rf"\text{{Value}} = {_frac_tex(closed)}")
        # enumeration of optimal policy via brute force over thresholds
        best = F(0)
        for th in itertools.product(range(1, 7), repeat=rerolls):
            tot = F(0)
            for seq in itertools.product(range(1, 7), repeat=rerolls + 1):
                val = seq[-1]
                for i in range(rerolls):
                    if seq[i] >= th[i]:
                        val = seq[i]
                        break
                tot += val
            best = max(best, tot / 6 ** (rerolls + 1))
        enum = best
    return _mk("ev_game", d, seed, prompt, closed, ("expected_value", "optimal_stopping"),
               ("What is the value of continuing?", "Keep only rolls above that value."), steps, enum)


def t_indicator(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    # Expected number of fixed points / distinct faces
    kind = rng.choice(["distinct_faces", "fixed_points"])
    if kind == "distinct_faces":
        n = rng.randint(2, 4 if d < 6 else 5)
        closed = 6 * (1 - F(5, 6) ** n)
        enum = F(sum(len(set(o)) for o in itertools.product(range(6), repeat=n)), 6**n)
        prompt = rf"\text{{Roll {n} fair dice. Expected number of distinct faces}} = ?"
        steps = (r"Let $I_k = 1$ if face $k$ appears. $\mathbb{E}[I_k] = 1-(5/6)^n$.",
                 rf"\mathbb{{E}} = 6\left(1-(5/6)^{n}\right) = {_frac_tex(closed)}")
    else:
        n = rng.randint(3, 6)
        closed = F(1)
        enum = F(sum(sum(1 for i, p in enumerate(perm) if i == p) for perm in itertools.permutations(range(n))), math.factorial(n))
        prompt = rf"\text{{A random permutation of {n} items. Expected number of fixed points}} = ?"
        steps = (r"Each position is fixed with probability $1/n$; summing $n$ indicators gives 1.",)
    return _mk("ev_indicator", d, seed, prompt, closed, ("expected_value", "indicator_variables"),
               ("Write the count as a sum of indicator variables.", "Use linearity of expectation."), steps, enum)


def t_variance(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    n = rng.randint(1, 3)
    outcomes = list(itertools.product(range(1, 7), repeat=n))
    mean = F(sum(sum(o) for o in outcomes), len(outcomes))
    enum = F(sum((sum(o) - mean) ** 2 for o in outcomes), len(outcomes))
    closed = n * F(35, 12)
    return _mk("variance_dice", d, seed, rf"\text{{Var of the sum of {n} fair dice}} = ?", closed,
               ("variance", "dice"), (r"Variance of one die is $35/12$; independent variances add.",),
               (rf"\mathrm{{Var}} = {n}\cdot\frac{{35}}{{12}} = {_frac_tex(closed)}",), enum)


def t_markov_absorb(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    # Gambler's ruin with fair coin: P(reach N before 0 | start k) = k/N; expected duration k(N-k)
    N = rng.randint(4, 6 + d)
    k = rng.randint(1, N - 1)
    if rng.random() < 0.5:
        closed = F(k, N)
        prompt = rf"\text{{Fair ±1 random walk from {k}, absorbed at 0 or {N}. }} P(\text{{hit {N} first}}) = ?"
        steps = (r"$h(x) = \tfrac12 h(x-1) + \tfrac12 h(x+1)$ with $h(0)=0, h(N)=1$ gives $h(x)=x/N$.",)
        tag = "random_walks"
        enum = _solve_ruin(N, k, duration=False)
    else:
        closed = F(k * (N - k))
        prompt = rf"\text{{Fair ±1 random walk from {k}, absorbed at 0 or {N}. Expected steps}} = ?"
        steps = (r"$m(x) = 1 + \tfrac12 m(x-1) + \tfrac12 m(x+1)$, $m(0)=m(N)=0$ gives $m(x)=x(N-x)$.",)
        tag = "markov_chains"
        enum = _solve_ruin(N, k, duration=True)
    return _mk("markov", d, seed, prompt, closed, ("stochastic_processes", tag),
               ("Set up a first-step equation.", "Solve the linear recurrence with boundary conditions."), steps, enum)


def _solve_ruin(N: int, k: int, duration: bool) -> Fraction:
    """Solve the first-step linear system exactly by Gaussian elimination over Fractions."""
    n = N - 1  # interior states 1..N-1
    A = [[F(0)] * n for _ in range(n)]
    bvec = [F(0)] * n
    for i in range(n):
        x = i + 1
        A[i][i] = F(1)
        for y in (x - 1, x + 1):
            if 1 <= y <= N - 1:
                A[i][y - 1] -= F(1, 2)
            elif y == N and not duration:
                bvec[i] += F(1, 2)
        if duration:
            bvec[i] += 1
    sol = solve_linear(A, bvec)
    return sol[k - 1]


def solve_linear(A: list[list[Fraction]], b: list[Fraction]) -> list[Fraction]:
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = next(r for r in range(c, n) if M[r][c] != 0)
        M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c and M[r][c] != 0:
                f = M[r][c] / M[c][c]
                M[r] = [M[r][j] - f * M[c][j] for j in range(n + 1)]
    return [M[i][n] / M[i][i] for i in range(n)]


TEMPLATES = {
    "dice": (t_dice_sum, 1),
    "coins": (t_coins_at_least, 1),
    "cards": (t_cards_conditional, 2),
    "urn": (t_urn, 2),
    "ev_game": (t_ev_game, 1),
    "variance": (t_variance, 3),
    "bayes": (t_bayes, 3),
    "ev_dice": (t_ev_max_dice, 4),
    "indicator": (t_indicator, 5),
    "markov": (t_markov_absorb, 6),
}


def gen_probability(rng: random.Random, d: int, seed: int, template: str | None = None) -> GeneratedQuestion:
    eligible = [k for k, (_, m) in TEMPLATES.items() if m <= d]
    key = template if template in TEMPLATES else rng.choice(eligible)
    return TEMPLATES[key][0](rng, d, seed)


def verify_probability(q: GeneratedQuestion) -> bool:
    enum = [s for s in q.solution_steps if s.startswith("enum:")]
    return all(s == "enum:True" for s in enum) and isinstance(q.answer, Fraction) and q.check(q.answer_display)
