"""ETF basket pricing and net executable arbitrage edge.

NAV per share = sum_i shares_i * price_i * fx_i / shares_per_unit_divisor
Executable edge must use the side of each market you would actually trade on:

  ETF rich  (sell ETF, buy basket):  edge = ETF_bid  - basket_ask_nav - costs
  ETF cheap (buy ETF, sell basket):  edge = basket_bid_nav - ETF_ask  - costs

costs = per-share fees on both legs + creation/redemption fee per share + slippage.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal


@dataclass(frozen=True)
class Constituent:
    symbol: str
    shares_per_etf: Decimal  # shares of the stock represented by ONE ETF share
    bid: Decimal
    ask: Decimal
    fx: Decimal = Decimal(1)  # local -> base currency

    @property
    def mid(self) -> Decimal:
        return (self.bid + self.ask) / 2


@dataclass(frozen=True)
class CostModel:
    fee_per_share_etf: Decimal = Decimal("0.005")
    fee_bps_basket: Decimal = Decimal("1")  # bps of basket notional
    creation_fee_per_share: Decimal = Decimal("0.01")
    slippage_bps: Decimal = Decimal("0.5")


def nav(constituents: list[Constituent], which: Literal["bid", "ask", "mid"] = "mid") -> Decimal:
    return sum((c.shares_per_etf * getattr(c, which) * c.fx for c in constituents), Decimal(0))


def costs_per_share(etf_price: Decimal, basket_value: Decimal, cm: CostModel) -> Decimal:
    bps = Decimal("0.0001")
    return (cm.fee_per_share_etf + basket_value * cm.fee_bps_basket * bps + cm.creation_fee_per_share
            + (etf_price + basket_value) * cm.slippage_bps * bps)


@dataclass(frozen=True)
class ArbAssessment:
    nav_mid: Decimal
    premium_bps: Decimal
    edge_sell_etf: Decimal  # per share, after costs
    edge_buy_etf: Decimal
    best_action: Literal["sell_etf_buy_basket", "buy_etf_sell_basket", "none"]
    best_edge: Decimal


def assess(etf_bid: Decimal, etf_ask: Decimal, cons: list[Constituent], cm: CostModel) -> ArbAssessment:
    nav_mid, nav_bid, nav_ask = nav(cons, "mid"), nav(cons, "bid"), nav(cons, "ask")
    etf_mid = (etf_bid + etf_ask) / 2
    sell_edge = etf_bid - nav_ask - costs_per_share(etf_bid, nav_ask, cm)
    buy_edge = nav_bid - etf_ask - costs_per_share(etf_ask, nav_bid, cm)
    premium = (etf_mid - nav_mid) / nav_mid * Decimal(10000)
    if sell_edge > 0 and sell_edge >= buy_edge:
        action, best = "sell_etf_buy_basket", sell_edge
    elif buy_edge > 0:
        action, best = "buy_etf_sell_basket", buy_edge
    else:
        action, best = "none", max(sell_edge, buy_edge)
    return ArbAssessment(nav_mid, premium, sell_edge, buy_edge, action, best)  # type: ignore[arg-type]
