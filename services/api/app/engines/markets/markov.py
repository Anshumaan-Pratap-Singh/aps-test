"""Exact discrete-time Markov chain utilities (Fraction arithmetic)."""

from __future__ import annotations

from fractions import Fraction

from app.engines.questions.probability import solve_linear

Matrix = list[list[Fraction]]


def validate(P: Matrix) -> None:
    n = len(P)
    for row in P:
        if len(row) != n or any(x < 0 for x in row) or sum(row) != 1:
            raise ValueError("not a stochastic matrix")


def matmul(A: Matrix, B: Matrix) -> Matrix:
    return [[sum((A[i][k] * B[k][j] for k in range(len(B))), Fraction(0)) for j in range(len(B[0]))] for i in range(len(A))]


def n_step(P: Matrix, n: int) -> Matrix:
    validate(P)
    size = len(P)
    R = [[Fraction(int(i == j)) for j in range(size)] for i in range(size)]
    B = P
    while n:
        if n & 1:
            R = matmul(R, B)
        B = matmul(B, B)
        n >>= 1
    return R


def stationary(P: Matrix) -> list[Fraction]:
    """Solve pi P = pi, sum pi = 1. Raises if the solution is not unique (singular system)."""
    validate(P)
    n = len(P)
    # (P^T - I) pi = 0 with last equation replaced by normalisation
    A = [[P[j][i] - (1 if i == j else 0) for j in range(n)] for i in range(n)]
    A[-1] = [Fraction(1)] * n
    b = [Fraction(0)] * (n - 1) + [Fraction(1)]
    try:
        return solve_linear(A, b)
    except StopIteration as exc:  # no pivot -> not unique
        raise ValueError("stationary distribution not unique") from exc
