from fractions import Fraction

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.engines.questions.base import check_answer, fmt, parse_number
from app.engines.questions.exact_eval import exact_eval
from app.engines.questions.registry import REGISTRY, generate, generate_batch
from app.engines.questions.sequences import alternative_answers, poly_next


@pytest.mark.parametrize("qtype", sorted(REGISTRY))
@pytest.mark.parametrize("difficulty", [1, 3, 5, 7, 10])
def test_every_generator_produces_verified_questions(qtype, difficulty):
    spec = REGISTRY[qtype]
    for seed in range(30):
        q = generate(qtype, seed, difficulty)
        assert q.check(q.answer_display), (q.prompt_latex, q.answer_display)
        if spec.verifier:
            assert spec.verifier(q)
        assert q.prompt_latex
        assert q.skill_tags


@settings(max_examples=150, deadline=None)
@given(qtype=st.sampled_from(sorted(REGISTRY)), seed=st.integers(0, 10**9), d=st.integers(1, 10))
def test_generators_deterministic_and_verified(qtype, seed, d):
    a, b = generate(qtype, seed, d), generate(qtype, seed, d)
    assert a == b
    assert a.question_id == b.question_id
    assert a.check(a.answer_display)


def test_batch_is_deterministic():
    assert [q.question_id for q in generate_batch("multiplication", 42, 5, 10)] == \
           [q.question_id for q in generate_batch("multiplication", 42, 5, 10)]


def test_public_payload_hides_answers():
    q = generate("probability", 3, 6)
    pub = q.public_payload(include_answer=False)
    assert "answer_display" not in pub and pub["solution_steps"] == [] and pub["hint_steps"] == []
    full = q.public_payload(include_answer=True)
    assert all(not s.startswith(("enum:", "verify:")) for s in full["solution_steps"])


@pytest.mark.parametrize("text,expected", [
    ("138.6", Fraction(1386, 10)), ("1/8", Fraction(1, 8)), ("12.5%", Fraction(25, 2)), ("-2.5", Fraction(-5, 2)),
    (" 1,200 ", Fraction(1200)), (".5", Fraction(1, 2)), ("abc", None), ("1/0", None), ("", None), ("1e5", None),
])
def test_parse_number(text, expected):
    assert parse_number(text) == expected


def test_spec_examples_exact():
    # 66 x ? = 138.6 -> 2.1, 17.5% of 480 = 84, 3.6 / 0.12 = 30, ? x 24 = 816 -> 34, 48 x 52 = 2496
    assert exact_eval("138.6/66") == Fraction(21, 10)
    assert exact_eval("17.5*480/100") == 84
    assert exact_eval("3.6/0.12") == 30
    assert exact_eval("816/24") == 34
    assert exact_eval("48*52") == 2496


def test_exact_eval_rejects_code():
    for bad in ["__import__('os')", "a+1", "2**100", "[1]", "(lambda: 1)()"]:
        with pytest.raises((ValueError, SyntaxError)):
            exact_eval(bad)


def test_fmt_round_trip():
    for x in [Fraction(1, 8), Fraction(21, 10), Fraction(1, 3), Fraction(-7, 4), Fraction(5)]:
        assert parse_number(fmt(x)) == x


def test_sequence_spec_examples():
    assert poly_next([Fraction(x) for x in [3, 8, 15, 24, 35]], 2) == 48
    assert poly_next([Fraction(x) for x in [2, 6, 12, 20, 30]], 2) == 42


def test_ambiguity_detection():
    # 1, 2, 4, 8 could be geometric (16); with only 4 terms a cubic also fits -> we never publish 4-term seqs.
    alts = alternative_answers([Fraction(x) for x in [1, 2, 4, 8, 16]])
    assert Fraction(32) in alts


def test_tolerance_questions():
    q = generate("approximation", 11, 5)
    assert q.rel_tolerance > 0
    exact = q.answer
    assert check_answer(q, str(float(exact) * (1 + float(q.rel_tolerance) * 0.9)))
    assert not check_answer(q, str(float(exact) * (1 + float(q.rel_tolerance) * 1.5)))


def test_missing_operator_unique():
    for s in range(200):
        q = generate("missing_operator", s, 5)
        assert q.answer in ("+", "-", "×", "÷")
