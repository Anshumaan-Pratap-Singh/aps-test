"""A tiny, safe, exact expression evaluator used for *independent* answer verification.

Only numeric literals, + - * / ** (small integer exponents) and parentheses are
permitted. Evaluates with Fraction so verification never relies on floats.
Never use ``eval``.
"""

from __future__ import annotations

import ast
from decimal import Decimal
from fractions import Fraction

_ALLOWED_BIN = {ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow}


def exact_eval(expr: str) -> Fraction:
    tree = ast.parse(expr.replace("×", "*").replace("÷", "/"), mode="eval")
    return _ev(tree.body)


def _ev(node: ast.AST) -> Fraction:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        # Re-parse float literals through their repr string to avoid binary error.
        return Fraction(Decimal(repr(node.value))) if isinstance(node.value, float) else Fraction(node.value)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        v = _ev(node.operand)
        return -v if isinstance(node.op, ast.USub) else v
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BIN:
        a, b = _ev(node.left), _ev(node.right)
        if isinstance(node.op, ast.Add):
            return a + b
        if isinstance(node.op, ast.Sub):
            return a - b
        if isinstance(node.op, ast.Mult):
            return a * b
        if isinstance(node.op, ast.Div):
            if b == 0:
                raise ZeroDivisionError
            return a / b
        if b.denominator != 1 or abs(b) > 10:
            raise ValueError("only small integer exponents permitted")
        return a ** int(b)
    raise ValueError(f"disallowed expression node: {type(node).__name__}")
