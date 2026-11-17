"""Core question-generation contracts.

Every generator is a pure function of (seed, difficulty). It returns a
``GeneratedQuestion`` that carries a public payload (safe to send to a client)
and a private ``answer`` used only for server-side validation.

Exactness: answers are stored as ``fractions.Fraction``. User input is parsed
into a Fraction and compared exactly unless the question declares a relative
tolerance (estimation questions only).
"""

from __future__ import annotations

import hashlib
import random
import re
import uuid
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from typing import Callable, Literal

InputType = Literal["numeric", "fraction", "choice", "operator", "multi"]

GENERATOR_VERSION = "1.0"


class GenerationError(RuntimeError):
    """Raised when a generator cannot produce a verified question."""


@dataclass(frozen=True)
class GeneratedQuestion:
    question_type: str
    difficulty: int
    seed: int
    prompt_latex: str
    input_type: InputType
    answer: Fraction | str
    answer_display: str
    skill_tags: tuple[str, ...]
    hint_steps: tuple[str, ...] = ()
    solution_steps: tuple[str, ...] = ()
    choices: tuple[str, ...] = ()
    rel_tolerance: Fraction = Fraction(0)
    generator_version: str = GENERATOR_VERSION

    @property
    def question_id(self) -> str:
        """Deterministic id: identical (type, seed, difficulty, version) -> identical id."""
        key = f"{self.question_type}:{self.difficulty}:{self.seed}:{self.generator_version}"
        return str(uuid.UUID(hashlib.sha256(key.encode()).hexdigest()[:32]))

    def public_payload(self, include_answer: bool = False) -> dict:
        payload: dict = {
            "question_id": self.question_id,
            "question_type": self.question_type,
            "difficulty": self.difficulty,
            "seed": self.seed,
            "prompt_latex": self.prompt_latex,
            "input_type": self.input_type,
            "choices": list(self.choices),
            "skill_tags": list(self.skill_tags),
            "generator_version": self.generator_version,
        }
        if include_answer:
            payload["answer_display"] = self.answer_display
            payload["hint_steps"] = list(self.hint_steps)
            payload["solution_steps"] = self.visible_solution_steps()
            payload["rel_tolerance"] = str(self.rel_tolerance)
        else:
            payload["hint_steps"] = []
            payload["solution_steps"] = []
        return payload

    def check(self, submitted: str) -> bool:
        return check_answer(self, submitted)

    def visible_solution_steps(self) -> list[str]:
        """Solution steps minus internal verification annotations."""
        return [s for s in self.solution_steps if not s.split(":", 1)[0] in _INTERNAL_PREFIXES]


_INTERNAL_PREFIXES = {"verify", "check", "enum", "terms", "family", "verify-op"}


Generator = Callable[[random.Random, int, int], GeneratedQuestion]

_NUM_RE = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)$")


def parse_number(text: str) -> Fraction | None:
    """Parse a user answer: integers, decimals, 'a/b', optional trailing '%'.

    Percent is *not* auto-divided: '12.5%' parses as 12.5 because questions
    that ask for percentages expect the percent figure.
    """
    s = text.strip().replace(",", "").replace(" ", "").replace("−", "-")
    if s.endswith("%"):
        s = s[:-1]
    if not s:
        return None
    if "/" in s:
        parts = s.split("/")
        if len(parts) != 2:
            return None
        num, den = parts
        if not (_NUM_RE.match(num) and _NUM_RE.match(den)):
            return None
        try:
            d = Fraction(Decimal(den))
            if d == 0:
                return None
            return Fraction(Decimal(num)) / d
        except (InvalidOperation, ValueError):
            return None
    if not _NUM_RE.match(s):
        return None
    try:
        return Fraction(Decimal(s))
    except (InvalidOperation, ValueError):
        return None


def check_answer(q: GeneratedQuestion, submitted: str) -> bool:
    if isinstance(q.answer, str):
        return submitted.strip().lower() == q.answer.strip().lower()
    value = parse_number(submitted)
    if value is None:
        return False
    if q.rel_tolerance == 0:
        return value == q.answer
    if q.answer == 0:
        return abs(value) <= q.rel_tolerance
    return abs(value - q.answer) <= abs(q.answer) * q.rel_tolerance


def fmt(x: Fraction, max_dp: int = 6) -> str:
    """Format an exact Fraction as a terminating decimal string, else a/b."""
    if x.denominator == 1:
        return str(x.numerator)
    d = x.denominator
    for p in (2, 5):
        while d % p == 0:
            d //= p
    if d != 1:
        return f"{x.numerator}/{x.denominator}"
    s = format(Decimal(x.numerator) / Decimal(x.denominator), "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if "." in s and len(s.split(".")[1]) > max_dp:
        return f"{x.numerator}/{x.denominator}"
    return s


def is_terminating(x: Fraction) -> bool:
    d = x.denominator
    for p in (2, 5):
        while d % p == 0:
            d //= p
    return d == 1


def clamp_difficulty(d: int) -> int:
    return max(1, min(10, int(d)))


def generate_verified(
    gen: Generator, seed: int, difficulty: int, verify: Callable[[GeneratedQuestion], bool] | None = None
) -> GeneratedQuestion:
    """Run a generator with a seeded RNG and verify the result before publishing.

    Retries with derived sub-seeds (deterministically) if the candidate fails
    verification. Determinism: same (gen, seed, difficulty) => same question.
    """
    difficulty = clamp_difficulty(difficulty)
    for attempt in range(25):
        rng = random.Random(f"{seed}:{attempt}")
        q = gen(rng, difficulty, seed)
        if not q.check(q.answer_display) and not isinstance(q.answer, str):
            continue  # display string must round-trip to the exact answer
        if verify is None or verify(q):
            return q
    raise GenerationError(f"generator failed verification for seed={seed} difficulty={difficulty}")


@dataclass
class QuestionTypeSpec:
    key: str
    title: str
    generator: Generator
    verifier: Callable[[GeneratedQuestion], bool] | None = None
    skill_tags: tuple[str, ...] = field(default_factory=tuple)
