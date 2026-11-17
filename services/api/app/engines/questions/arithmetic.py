"""Mental-arithmetic generators (speed maths, missing operand, percentages...).

Difficulty (1-10) controls operand magnitude, decimal places and number of steps.
Every generator records a machine-checkable ``verify_expr`` in its solution so
that ``verify_arithmetic`` can independently recompute the answer.
"""

from __future__ import annotations

import random
from decimal import Decimal
from fractions import Fraction

from .base import GeneratedQuestion, fmt, is_terminating
from .exact_eval import exact_eval

D = Fraction


def _n(rng: random.Random, lo: int, hi: int) -> int:
    return rng.randint(lo, hi)


def _dec(rng: random.Random, lo: int, hi: int, dp: int) -> Fraction:
    """Random decimal with exactly up to `dp` places in [lo, hi]."""
    scale = 10**dp
    return D(rng.randint(lo * scale, hi * scale), scale)


def _mag(d: int) -> tuple[int, int]:
    table = {1: (2, 9), 2: (2, 12), 3: (3, 20), 4: (6, 40), 5: (11, 99), 6: (12, 150),
             7: (21, 250), 8: (101, 999), 9: (101, 1999), 10: (201, 4999)}
    return table[d]


def _q(qtype: str, d: int, seed: int, prompt: str, answer: Fraction, tags: tuple[str, ...],
       expr: str, hints: tuple[str, ...] = (), steps: tuple[str, ...] = ()) -> GeneratedQuestion:
    return GeneratedQuestion(
        question_type=qtype, difficulty=d, seed=seed, prompt_latex=prompt, input_type="numeric",
        answer=answer, answer_display=fmt(answer), skill_tags=tags, hint_steps=hints,
        solution_steps=steps + (f"verify:{expr}",),
    )


def gen_multiplication(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    lo, hi = _mag(d)
    a = _n(rng, lo, hi)
    b = _n(rng, 2, 12) if d <= 2 else _n(rng, max(2, lo // 2), max(12, hi // (3 if d < 8 else 8)))
    # Near-square trick at mid difficulty: 48 x 52 = 50^2 - 2^2
    if d in (4, 5, 6) and rng.random() < 0.3:
        m = rng.choice([20, 30, 40, 50, 60, 70, 80, 90])
        k = rng.randint(1, 5)
        a, b = m - k, m + k
        hint = (rf"Write as $({m}-{k})({m}+{k}) = {m}^2 - {k}^2$.",)
    else:
        hint = ("Split one factor into tens and units and distribute.",)
    ans = D(a * b)
    return _q("multiplication", d, seed, rf"{a} \times {b} = ?", ans, ("arithmetic", "multiplication"),
              f"{a}*{b}", hint, (rf"{a} \times {b} = {fmt(ans)}",))


def gen_division(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    lo, hi = _mag(d)
    q = _n(rng, lo, max(lo + 1, hi // 2))
    b = _n(rng, 2, 9 if d <= 3 else 25 if d <= 6 else 99)
    a = q * b
    ans = D(q)
    return _q("division", d, seed, rf"{a} \div {b} = ?", ans, ("arithmetic", "division"),
              f"{a}/{b}", ("Estimate the quotient's magnitude first, then refine.",), (rf"{b} \times {q} = {a}",))


def gen_add_sub(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    scale = 10 ** min(1 + d // 2, 5)
    a, b = _n(rng, scale // 10 + 1, scale), _n(rng, scale // 10 + 1, scale)
    if rng.random() < 0.5:
        ans, prompt, expr = D(a + b), rf"{a} + {b} = ?", f"{a}+{b}"
    else:
        ans, prompt, expr = D(a - b), rf"{a} - {b} = ?", f"{a}-{b}"
    return _q("add_sub", d, seed, prompt, ans, ("arithmetic", "addition"), expr,
              ("Work left to right in place-value chunks.",))


def gen_decimal_mult(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    dp = 1 if d <= 4 else 2
    a = _dec(rng, 1, 9 if d <= 3 else 40 if d <= 7 else 99, dp)
    b = _dec(rng, 1, 9, 1) if d <= 6 else _dec(rng, 1, 20, 2)
    if a == 0 or b == 0:
        a, b = D(3, 2), D(12, 10)
    ans = a * b
    return _q("decimal_mult", d, seed, rf"{fmt(a)} \times {fmt(b)} = ?", ans, ("arithmetic", "decimals"),
              f"{fmt(a)}*{fmt(b)}", ("Multiply as integers, then place the decimal point by counting places.",))


def gen_decimal_div(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    # Construct so the quotient is clean: a = q * b with b a decimal (e.g. 3.6 / 0.12 = 30)
    b = D(rng.choice([2, 3, 4, 5, 6, 8, 12, 15, 25]), rng.choice([10, 100]) if d >= 3 else 10)
    q = D(rng.randint(2, 20 if d <= 5 else 120))
    if d >= 7 and rng.random() < 0.5:
        q = q / 10
    a = q * b
    return _q("decimal_div", d, seed, rf"{fmt(a)} \div {fmt(b)} = ?", q, ("arithmetic", "decimals", "division"),
              f"{fmt(a)}/{fmt(b)}", ("Scale both numbers by the same power of 10 to clear the divisor's decimals.",))


_PCTS_EASY = [10, 20, 25, 50, 5, 15, 30, 40, 75]
_PCTS_HARD = [12.5, 17.5, 37.5, 62.5, 2.5, 7.5, 22.5, 33, 66, 8, 12, 35, 45, 65, 85]


def gen_percent_of(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    p = D(Decimal(str(rng.choice(_PCTS_EASY if d <= 4 else _PCTS_HARD))))
    base = rng.choice([40, 60, 80, 120, 160, 200, 240, 320, 360, 400, 480, 640, 720, 800, 960, 1200])
    if d >= 8:
        base = rng.randint(101, 999) * 2
    ans = p * base / 100
    return _q("percent_of", d, seed, rf"{fmt(p)}\% \text{{ of }} {base} = ?", ans, ("percentages",),
              f"{fmt(p)}*{base}/100", (rf"Decompose {fmt(p)}% into easy parts (10%, 5%, 1%, ...).",),
              (rf"{fmt(p)}\% \times {base} = {fmt(ans)}",))


def gen_percent_change(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    old = rng.choice([20, 25, 40, 50, 80, 120, 125, 160, 200, 250, 400, 500, 800])
    pct = D(Decimal(str(rng.choice([5, 10, 15, 20, 25, 30, 40, 50, 60, 75] if d <= 5 else [2.5, 12.5, 17.5, 35, 62.5, 4, 8, 45]))))
    sign = rng.choice([1, -1])
    new = old * (1 + sign * pct / 100)
    if rng.random() < 0.5:
        ans = sign * pct
        prompt = rf"\text{{From }} {fmt(D(old))} \text{{ to }} {fmt(new)}\text{{: percentage change}} = ?\,\%"
        expr = f"({fmt(new)}-{old})/{old}*100"
        hint = (r"Percentage change $= \frac{\text{new}-\text{old}}{\text{old}}\times 100$.",)
    else:
        ans = new
        verb = "increased" if sign > 0 else "decreased"
        prompt = rf"{old} \text{{ {verb} by }} {fmt(pct)}\% = ?"
        expr = f"{old}*(1{'+' if sign > 0 else '-'}{fmt(pct)}/100)"
        hint = (rf"Multiply by $1 {'+' if sign > 0 else '-'} {fmt(pct / 100)}$.",)
    return _q("percent_change", d, seed, prompt, ans, ("percentages", "percent_change"), expr, hint)


def gen_squares(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    hi = {1: 12, 2: 15, 3: 20, 4: 25, 5: 35, 6: 50, 7: 75, 8: 99, 9: 150, 10: 250}[d]
    a = rng.randint(4, hi)
    return _q("squares", d, seed, rf"{a}^2 = ?", D(a * a), ("arithmetic", "squares"), f"{a}**2",
              (r"Use $(a\pm b)^2 = a^2 \pm 2ab + b^2$ around a round number.",))


def gen_cubes(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    hi = {1: 5, 2: 6, 3: 8, 4: 10, 5: 12, 6: 13, 7: 15, 8: 18, 9: 21, 10: 25}[d]
    a = rng.randint(2, hi)
    return _q("cubes", d, seed, rf"{a}^3 = ?", D(a**3), ("arithmetic", "cubes"), f"{a}**3")


def gen_sqrt(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    hi = {1: 12, 2: 15, 3: 20, 4: 25, 5: 32, 6: 45, 7: 60, 8: 80, 9: 99, 10: 150}[d]
    a = rng.randint(2, hi)
    if d >= 7 and rng.random() < 0.4:  # decimal root e.g. sqrt(2.25)=1.5
        num = D(a, 10)
        return _q("sqrt", d, seed, rf"\sqrt{{{fmt(num * num)}}} = ?", num, ("arithmetic", "roots"),
                  f"{fmt(num)}", ("Remove the decimal: the root has half as many decimal places.",))
    return _q("sqrt", d, seed, rf"\sqrt{{{a * a}}} = ?", D(a), ("arithmetic", "roots"), f"{a}",
              ("The last digit of the square constrains the last digit of the root.",))


def gen_fraction_arith(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    den_hi = 6 if d <= 3 else 12 if d <= 7 else 20
    a = D(rng.randint(1, den_hi - 1), rng.randint(2, den_hi))
    b = D(rng.randint(1, den_hi - 1), rng.randint(2, den_hi))
    op = rng.choice(["+", "-", r"\times"]) if d < 6 else rng.choice(["+", "-", r"\times", r"\div"])
    ans = {"+": a + b, "-": a - b, r"\times": a * b, r"\div": a / b}[op]
    pyop = {"+": "+", "-": "-", r"\times": "*", r"\div": "/"}[op]
    fa = rf"\frac{{{a.numerator}}}{{{a.denominator}}}"
    fb = rf"\frac{{{b.numerator}}}{{{b.denominator}}}"
    q = _q("fraction_arith", d, seed, rf"{fa} {op} {fb} = ?", ans, ("fractions",),
           f"({a.numerator}/{a.denominator}){pyop}({b.numerator}/{b.denominator})",
           ("Use a common denominator (lcm) for + and −.",))
    # answer may be non-terminating; accept as fraction input
    return GeneratedQuestion(**{**q.__dict__, "input_type": "fraction", "answer_display":
                                f"{ans.numerator}/{ans.denominator}" if ans.denominator != 1 else str(ans.numerator)})


def gen_approximation(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    a = D(rng.randint(1000, 99999), rng.choice([1, 10, 100]))
    b = D(rng.randint(100, 9999), rng.choice([1, 10, 100]))
    op = rng.choice(["*", "/"])
    exact = a * b if op == "*" else a / b
    tol = D(5, 100) if d <= 5 else D(2, 100)
    latex_op = r"\times" if op == "*" else r"\div"
    # display a rounded value that is within tolerance
    rounded = D(round(Decimal(exact.numerator) / Decimal(exact.denominator), 2))
    return GeneratedQuestion(
        question_type="approximation", difficulty=d, seed=seed,
        prompt_latex=rf"{fmt(a)} {latex_op} {fmt(b)} \approx ? \quad (\pm {int(tol * 100)}\%)",
        input_type="numeric", answer=exact, answer_display=fmt(rounded),
        skill_tags=("estimation", "arithmetic"), rel_tolerance=tol,
        hint_steps=("Round each operand to 2 significant figures and correct for the direction of rounding.",),
        solution_steps=(f"verify:{fmt(a)}{op}{fmt(b)}",),
    )


def gen_missing_operand(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    kind = rng.choice(["mul", "mul_left", "div_num", "div_den", "pct", "base", "add"]) if d >= 3 else rng.choice(["mul", "add", "div_num"])
    lo, hi = _mag(min(d, 8))
    if kind in ("mul", "mul_left"):
        a = rng.randint(lo, hi)
        x = D(rng.randint(2, 30)) if d < 5 else _dec(rng, 1, 9, 1)  # e.g. 66 x 2.1 = 138.6
        if x == 0:
            x = D(21, 10)
        c = a * x
        prompt = rf"{a} \times ? = {fmt(c)}" if kind == "mul" else rf"? \times {a} = {fmt(c)}"
        expr, check = f"{fmt(c)}/{a}", f"{a}*X=={fmt(c)}"
    elif kind == "div_num":
        b = rng.randint(2, 12 if d < 5 else 40)
        q = rng.randint(2, 50 if d < 5 else 300)
        x = D(b * q)
        prompt, expr, check = rf"? \div {b} = {q}", f"{b}*{q}", f"X/{b}=={q}"
    elif kind == "div_den":
        q = rng.randint(2, 40)
        x = D(rng.randint(2, 25))
        a = x * q
        prompt, expr, check = rf"{fmt(a)} \div ? = {q}", f"{fmt(a)}/{q}", f"{fmt(a)}/X=={q}"
    elif kind == "pct":
        base = rng.choice([80, 120, 160, 240, 400, 480, 600, 800])
        x = D(Decimal(str(rng.choice([5, 12.5, 15, 17.5, 20, 35, 37.5, 45, 62.5]))))
        c = x * base / 100
        prompt, expr, check = rf"?\% \text{{ of }} {base} = {fmt(c)}", f"{fmt(c)}/{base}*100", f"X*{base}/100=={fmt(c)}"
    elif kind == "base":
        p = D(rng.choice([10, 20, 25, 40, 50, 75, 125, 150]))
        x = D(rng.choice([40, 64, 80, 120, 160, 200, 320, 480]))
        c = p * x / 100
        prompt, expr, check = rf"{fmt(p)}\% \text{{ of }} ? = {fmt(c)}", f"{fmt(c)}*100/{fmt(p)}", f"{fmt(p)}*X/100=={fmt(c)}"
    else:
        a = rng.randint(lo, hi * 3)
        x = D(rng.randint(lo, hi * 3))
        prompt, expr, check = rf"{a} + ? = {a + x}", f"{a + x}-{a}", f"{a}+X=={a + x}"
    return GeneratedQuestion(
        question_type="missing_operand", difficulty=d, seed=seed, prompt_latex=prompt, input_type="numeric",
        answer=x, answer_display=fmt(x), skill_tags=("arithmetic", "missing_operand"),
        hint_steps=("Isolate the unknown by applying the inverse operation to both sides.",),
        solution_steps=(f"verify:{expr}", f"check:{check}"),
    )


def gen_missing_operator(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    ops = {"+": lambda a, b: a + b, "-": lambda a, b: a - b, "*": lambda a, b: a * b, "/": lambda a, b: a / b}
    latex = {"+": "+", "-": "-", "*": r"\times", "/": r"\div"}
    for _ in range(50):
        a, b = D(rng.randint(2, 12 * d)), D(rng.randint(2, 12 + d))
        op = rng.choice(list(ops))
        if op == "/":
            a = b * rng.randint(2, 12 + d)
        c = ops[op](a, b)
        # Reject ambiguity: exactly one operator must satisfy a ? b = c.
        if sum(1 for o, f in ops.items() if f(a, b) == c) == 1:
            return GeneratedQuestion(
                question_type="missing_operator", difficulty=d, seed=seed,
                prompt_latex=rf"{fmt(a)} \;\square\; {fmt(b)} = {fmt(c)}", input_type="choice",
                choices=("+", "-", "×", "÷"),
                answer={"+": "+", "-": "-", "*": "×", "/": "÷"}[op],
                answer_display={"+": "+", "-": "-", "*": "×", "/": "÷"}[op],
                skill_tags=("arithmetic", "missing_operator"),
                solution_steps=(rf"{fmt(a)} {latex[op]} {fmt(b)} = {fmt(c)}", f"verify-op:{fmt(a)}{op}{fmt(b)}=={fmt(c)}"),
            )
    raise RuntimeError("could not construct unambiguous operator question")


def gen_mixed(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    gens = [gen_multiplication, gen_division, gen_add_sub, gen_decimal_mult, gen_decimal_div,
            gen_percent_of, gen_missing_operand, gen_squares]
    return rng.choice(gens)(rng, d, seed)


def gen_multi_step(rng: random.Random, d: int, seed: int) -> GeneratedQuestion:
    a, b, c = rng.randint(2, 9 + d * 2), rng.randint(2, 9 + d), rng.randint(2, 30 + d * 5)
    e = rng.randint(2, 9)
    form = rng.choice(["(a*b+c)", "(a*b-c)", "(a+b)*e-c", "a*b*e"])
    expr = form.replace("a", str(a)).replace("b", str(b)).replace("c", str(c)).replace("e", str(e))
    ans = exact_eval(expr)
    latex = expr.replace("*", r" \times ")
    return _q("multi_step", d, seed, latex + " = ?", ans, ("arithmetic", "multi_step"), expr,
              ("Respect order of operations; compute products first.",))


def verify_arithmetic(q: GeneratedQuestion) -> bool:
    """Independent verification by recomputing from the recorded expression."""
    for step in q.solution_steps:
        if step.startswith("verify:"):
            value = exact_eval(step[len("verify:"):])
            if q.rel_tolerance:
                if abs(value - q.answer) > abs(value) * q.rel_tolerance:  # type: ignore[operator]
                    return False
            elif value != q.answer:
                return False
        if step.startswith("check:") and isinstance(q.answer, Fraction):
            lhs, rhs = step[len("check:"):].split("==")
            x = f"({q.answer.numerator}/{q.answer.denominator})"
            if exact_eval(lhs.replace("X", x)) != exact_eval(rhs):
                return False
        if step.startswith("verify-op:"):
            lhs, rhs = step[len("verify-op:"):].split("==")
            if exact_eval(lhs) != exact_eval(rhs):
                return False
    # Speed-arithmetic answers must be enterable as a short decimal unless fraction input.
    if isinstance(q.answer, Fraction) and q.input_type == "numeric" and not q.rel_tolerance:
        if not is_terminating(q.answer):
            return False
    return True


ARITHMETIC_GENERATORS = {
    "multiplication": gen_multiplication,
    "division": gen_division,
    "add_sub": gen_add_sub,
    "decimal_mult": gen_decimal_mult,
    "decimal_div": gen_decimal_div,
    "percent_of": gen_percent_of,
    "percent_change": gen_percent_change,
    "squares": gen_squares,
    "cubes": gen_cubes,
    "sqrt": gen_sqrt,
    "fraction_arith": gen_fraction_arith,
    "approximation": gen_approximation,
    "missing_operand": gen_missing_operand,
    "missing_operator": gen_missing_operator,
    "mixed": gen_mixed,
    "multi_step": gen_multi_step,
}
