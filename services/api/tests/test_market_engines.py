import math
from decimal import Decimal
from fractions import Fraction

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.engines.markets import etf, event, markov, quoting, scoring
from app.engines.questions.probability import solve_linear

D = Decimal


# ---------- quoting ----------

def test_quote_symmetric_when_flat():
    q = quoting.make_quote(quoting.QuoteParams(fair_value=D("100"), volatility=D("0.2")))
    assert q.bid is not None and q.ask is not None
    assert q.bid < D("100") < q.ask
    assert D("100") - q.bid == q.ask - D("100")


@settings(max_examples=200, deadline=None)
@given(inv=st.integers(-9, 9), vol=st.decimals("0", "2", places=2), tox=st.decimals("0", "1", places=2))
def test_quote_properties(inv, vol, tox):
    p = quoting.QuoteParams(fair_value=D("50"), volatility=vol, toxicity=tox, inventory=inv)
    q = quoting.make_quote(p)
    assert q.ask > q.bid  # type: ignore[operator]
    # skew direction: long inventory lowers quotes
    flat = quoting.make_quote(quoting.QuoteParams(fair_value=D("50"), volatility=vol, toxicity=tox, inventory=0))
    if inv > 0 and vol > 0:
        assert q.quote_mid < flat.quote_mid
    if inv < 0 and vol > 0:
        assert q.quote_mid > flat.quote_mid
    # tick alignment
    assert (q.bid / p.tick) == (q.bid / p.tick).to_integral_value()


def test_spread_widens_with_vol_and_toxicity():
    base = quoting.make_quote(quoting.QuoteParams(fair_value=D(10), volatility=D("0.1")))
    vol = quoting.make_quote(quoting.QuoteParams(fair_value=D(10), volatility=D("0.5")))
    tox = quoting.make_quote(quoting.QuoteParams(fair_value=D(10), volatility=D("0.5"), toxicity=D("0.8")))
    assert base.half_spread < vol.half_spread < tox.half_spread


def test_inventory_limits_pull_quotes():
    q = quoting.make_quote(quoting.QuoteParams(fair_value=D(10), volatility=D("0.1"), inventory=10, max_inventory=10))
    assert q.bid is None and q.ask is not None
    book = quoting.Book(max_inventory=2)
    book.apply(quoting.Fill("buy", D(10), 2))
    with pytest.raises(quoting.RiskLimitError):
        book.apply(quoting.Fill("buy", D(10), 1))


def test_pnl_accounting():
    b = quoting.Book(max_inventory=10)
    b.apply(quoting.Fill("buy", D("10.00"), 3))
    b.apply(quoting.Fill("buy", D("11.00"), 1))
    assert b.avg_cost == D("10.25")
    b.apply(quoting.Fill("sell", D("12.00"), 2))
    assert b.realised == D("3.50")
    assert b.inventory == 2
    assert b.unrealised(D("11")) == D("1.50")
    assert Fraction(b.mtm(D("11"))) == b.realised + b.unrealised(D("11"))
    b.apply(quoting.Fill("sell", D("9.00"), 4))  # flip short 2
    assert b.inventory == -2 and b.avg_cost == D("9.00")
    assert b.mtm(D("9")) == b.realised


@settings(max_examples=150, deadline=None)
@given(st.lists(st.tuples(st.sampled_from(["buy", "sell"]), st.integers(90, 110), st.integers(1, 3)), max_size=30),
       st.integers(80, 120))
def test_mtm_identity(fills, mark):
    b = quoting.Book(max_inventory=1000)
    for side, px, q in fills:
        b.apply(quoting.Fill(side, D(px), q))
    m = D(mark)
    assert Fraction(b.mtm(m)) == b.realised + b.unrealised(m)


# ---------- events ----------

@settings(max_examples=200, deadline=None)
@given(prior=st.floats(0.01, 0.99), r=st.floats(0.5, 0.99), yes=st.booleans())
def test_event_update_valid_and_matches_bayes(prior, r, yes):
    post = event.update(prior, r, yes)
    assert 0 < post < 1
    exact = event.update_exact(Fraction(prior), Fraction(r), yes)
    assert math.isclose(post, float(exact), rel_tol=1e-6, abs_tol=1e-4)
    if r > 0.5:
        assert (post >= prior) if yes else (post <= prior)


def test_event_contract_quote_bounds_and_widening():
    b1, a1 = event.binary_contract_quote(0.5, uncertainty=0.05, toxicity=0.0, inventory=0)
    b2, a2 = event.binary_contract_quote(0.5, uncertainty=0.2, toxicity=0.8, inventory=0)
    assert a2 - b2 > a1 - b1
    b3, a3 = event.binary_contract_quote(0.99, uncertainty=0.5, toxicity=1, inventory=-50)
    assert 0 <= b3 < a3 <= 100


# ---------- ETF ----------

def _basket(spread="0.01"):
    s = D(spread)
    return [etf.Constituent("AAA", D("0.5"), D("100") - s, D("100") + s),
            etf.Constituent("BBB", D("0.3"), D("50") - s, D("50") + s),
            etf.Constituent("CCC", D("0.2"), D("25") - s, D("25") + s, fx=D("1.25"))]


def test_nav():
    assert etf.nav(_basket(), "mid") == D("0.5") * 100 + D("0.3") * 50 + D("0.2") * 25 * D("1.25")


def test_no_edge_when_etf_at_nav():
    cons = _basket()
    nav = etf.nav(cons)
    a = etf.assess(nav - D("0.01"), nav + D("0.01"), cons, etf.CostModel())
    assert a.best_action == "none" and a.best_edge < 0


@settings(max_examples=200, deadline=None)
@given(off=st.decimals("-0.03", "0.03", places=3))
def test_no_arbitrage_inside_cost_band(off):
    """ETF quoted within costs of NAV must never show positive net edge."""
    cons = _basket()
    cm = etf.CostModel()
    nav = etf.nav(cons)
    a = etf.assess(nav + off - D("0.01"), nav + off + D("0.01"), cons, cm)
    assert a.best_edge <= 0


def test_edge_detected_when_rich():
    cons = _basket()
    nav = etf.nav(cons)
    a = etf.assess(nav + D("1.00"), nav + D("1.02"), cons, etf.CostModel())
    assert a.best_action == "sell_etf_buy_basket" and a.best_edge > 0


# ---------- scoring ----------

def test_interval_score_is_proper_against_widening():
    # truth inside both: narrower wins
    assert scoring.interval_score(1, 2, 1.5, 0.2) < scoring.interval_score(0, 3, 1.5, 0.2)
    # miss penalty
    assert scoring.interval_score(1, 2, 3, 0.2) == 1 + 10 * 1


def test_interval_score_propriety_numeric():
    """Expected IS under a uniform(0,1) truth is minimised at the true quantiles."""
    alpha = 0.2
    grid = [i / 200 for i in range(201)]

    def expected(l, u):
        return sum(scoring.interval_score(l, u, x, alpha) for x in grid) / len(grid)

    best = expected(0.1, 0.9)
    for l, u in [(0.0, 1.0), (0.2, 0.8), (0.05, 0.95), (0.15, 0.85), (0.1, 0.8)]:
        assert expected(l, u) >= best - 1e-9


def test_kelly_and_ev():
    assert scoring.implied_probability(2.5) == 0.4
    assert math.isclose(scoring.expected_value(0.5, 2.2), 0.1)
    assert math.isclose(scoring.kelly_fraction(0.5, 2.2), 0.1 / 1.2)
    assert scoring.kelly_fraction(0.3, 2.0) == 0
    assert scoring.stake_size(1000, 0.6, 2.0, 0.5, cap=0.05) == 50


def test_fermi_score():
    s = scoring.fermi_score(1e6, 5e5, 2e6, 1.2e6)
    assert s["covered"] and 0 < s["composite"] <= 100
    wide = scoring.fermi_score(1e6, 1e3, 1e9, 1.2e6)
    assert wide["composite"] < s["composite"]


# ---------- markov ----------

def test_stationary_two_state():
    P = [[Fraction(9, 10), Fraction(1, 10)], [Fraction(1, 2), Fraction(1, 2)]]
    pi = markov.stationary(P)
    assert pi == [Fraction(5, 6), Fraction(1, 6)]
    P50 = markov.n_step(P, 2)
    assert P50[0][0] == Fraction(9, 10) * Fraction(9, 10) + Fraction(1, 10) * Fraction(1, 2)


def test_markov_rejects_non_stochastic():
    with pytest.raises(ValueError):
        markov.validate([[Fraction(1, 2), Fraction(1, 3)], [Fraction(1), Fraction(0)]])


def test_solve_linear():
    assert solve_linear([[Fraction(2), Fraction(1)], [Fraction(1), Fraction(3)]], [Fraction(3), Fraction(5)]) == \
        [Fraction(4, 5), Fraction(7, 5)]
