"""Registry of question types. Add a new trainer by registering a spec here."""

from __future__ import annotations

from .arithmetic import ARITHMETIC_GENERATORS, verify_arithmetic
from .base import GeneratedQuestion, QuestionTypeSpec, generate_verified
from .fractions_ import gen_fraction_conversion, verify_fraction
from .olympiad import gen_olympiad, verify_olympiad
from .probability import gen_probability, verify_probability
from .sequences import gen_sequence, verify_sequence

REGISTRY: dict[str, QuestionTypeSpec] = {}

for key, gen in ARITHMETIC_GENERATORS.items():
    REGISTRY[key] = QuestionTypeSpec(key=key, title=key.replace("_", " ").title(), generator=gen,
                                     verifier=verify_arithmetic, skill_tags=("arithmetic",))

REGISTRY["sequence"] = QuestionTypeSpec("sequence", "Number Sequences", gen_sequence, verify_sequence, ("sequences",))
REGISTRY["fraction_conversion"] = QuestionTypeSpec("fraction_conversion", "Fractions to Decimals",
                                                   gen_fraction_conversion, verify_fraction, ("fractions",))
REGISTRY["probability"] = QuestionTypeSpec("probability", "Probability & EV", gen_probability, verify_probability,
                                           ("probability",))
REGISTRY["olympiad"] = QuestionTypeSpec("olympiad", "Competition Problems", gen_olympiad, verify_olympiad,
                                        ("problem_solving",))


def generate(question_type: str, seed: int, difficulty: int) -> GeneratedQuestion:
    spec = REGISTRY[question_type]
    return generate_verified(spec.generator, seed, difficulty, spec.verifier)


def generate_batch(question_type: str, base_seed: int, difficulty: int, count: int) -> list[GeneratedQuestion]:
    """Deterministic batch: question i uses seed base_seed*100003 + i."""
    return [generate(question_type, base_seed * 100003 + i, difficulty) for i in range(count)]
