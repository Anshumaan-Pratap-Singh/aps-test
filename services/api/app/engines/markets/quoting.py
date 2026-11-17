"""Two-sided quoting engine and market-maker P&L accounting.

Model (transparent, testable):

    half_spread = max(tick, base_half_spread
                        + k_vol   * volatility
                        + k_tox   * toxicity * volatility)
    skew        = risk_aversion * inventory * volatility**2      (Avellaneda–Stoikov-style reservation shift)
    quote_mid   = fair_value - skew
    bid         = floor_to_tick(quote_mid - half_spread)
    ask         = ceil_to_tick (quote_mid + half_spread)

Hard inventory limits: at +max_inventory no bid is shown; at -max_inventory no ask.
All prices use Decimal. Inventory is an integer number of contracts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal
from typing import Literal

Side = Literal["buy", "sell"]


def to_tick(price: Decimal, tick: Decimal, mode: str) -> Decimal:
    return (price / tick).to_integral_value(rounding=mode) * tick


@dataclass(frozen=True)
class QuoteParams:
    fair_value: Decimal
    volatility: Decimal
    base_half_spread: Decimal = Decimal("0.05")
    k_vol: Decimal = Decimal("0.5")
    k_tox: Decimal = Decimal("1.0")
    toxicity: Decimal = Decimal("0")  # in [0, 1]
    risk_aversion: Decimal = Decimal("0.1")
    inventory: int = 0
    max_inventory: int = 10
    tick: Decimal = Decimal("0.01")


@dataclass(frozen=True)
class Quote:
    bid: Decimal | None
    ask: Decimal | None
    quote_mid: Decimal
    half_spread: Decimal
    skew: Decimal


def make_quote(p: QuoteParams) -> Quote:
    if not (Decimal(0) <= p.toxicity <= Decimal(1)):
        raise ValueError("toxicity must be in [0,1]")
    if p.volatility < 0:
        raise ValueError("volatility must be non-negative")
    half = max(p.tick, p.base_half_spread + p.k_vol * p.volatility + p.k_tox * p.toxicity * p.volatility)
    skew = p.risk_aversion * Decimal(p.inventory) * p.volatility * p.volatility
    mid = p.fair_value - skew
    bid = to_tick(mid - half, p.tick, ROUND_FLOOR)
    ask = to_tick(mid + half, p.tick, ROUND_CEILING)
    if ask <= bid:
        ask = bid + p.tick
    return Quote(
        bid=None if p.inventory >= p.max_inventory else bid,
        ask=None if p.inventory <= -p.max_inventory else ask,
        quote_mid=mid, half_spread=half, skew=skew,
    )


@dataclass
class Fill:
    side: Side  # side from the MARKET MAKER's perspective
    price: Decimal
    qty: int


@dataclass
class Book:
    """Position + cash ledger. Realised P&L uses average-cost accounting.

    Average cost and realised P&L are tracked as exact Fractions internally so the
    identity ``mtm == realised + unrealised`` holds exactly (Decimal division of an
    average cost would introduce rounding). Cash is exact Decimal.
    """

    max_inventory: int
    inventory: int = 0
    cash: Decimal = Decimal(0)
    avg_cost: Fraction = Fraction(0)
    realised: Fraction = Fraction(0)
    fills: list[Fill] = field(default_factory=list)

    def apply(self, fill: Fill) -> None:
        if fill.qty <= 0:
            raise ValueError("qty must be positive")
        signed = fill.qty if fill.side == "buy" else -fill.qty
        new_inv = self.inventory + signed
        if abs(new_inv) > self.max_inventory:
            raise RiskLimitError(f"fill would breach inventory limit {self.max_inventory}: {new_inv}")
        self.cash -= Decimal(signed) * fill.price
        px = Fraction(fill.price)
        if self.inventory == 0 or (self.inventory > 0) == (signed > 0):
            # increasing position
            total = abs(self.inventory) + abs(signed)
            self.avg_cost = (self.avg_cost * abs(self.inventory) + px * abs(signed)) / total
        else:
            closing = min(abs(signed), abs(self.inventory))
            direction = 1 if self.inventory > 0 else -1
            self.realised += direction * closing * (px - self.avg_cost)
            if abs(signed) > abs(self.inventory):  # flipped
                self.avg_cost = px
            elif new_inv == 0:
                self.avg_cost = Fraction(0)
        self.inventory = new_inv
        self.fills.append(fill)

    def unrealised(self, mark: Decimal) -> Fraction:
        return self.inventory * (Fraction(mark) - self.avg_cost)

    def mtm(self, mark: Decimal) -> Decimal:
        """Mark-to-market total P&L = cash + inventory * mark (starting from zero cash)."""
        return self.cash + Decimal(self.inventory) * mark

    def realised_decimal(self, places: int = 6) -> Decimal:
        return round(Decimal(self.realised.numerator) / Decimal(self.realised.denominator), places)


class RiskLimitError(ValueError):
    pass


def adverse_selection(fills: list[Fill], future_fair: list[Decimal]) -> Decimal:
    """Average signed post-trade fair-value move against the maker.

    For a maker BUY at p followed by fair value f', the markout is f' - p.
    Negative average markout indicates adverse selection.
    """
    if not fills:
        return Decimal(0)
    tot = Decimal(0)
    for f, fv in zip(fills, future_fair, strict=True):
        sign = 1 if f.side == "buy" else -1
        tot += Decimal(sign) * (fv - f.price) * f.qty
    return tot / Decimal(sum(f.qty for f in fills))
