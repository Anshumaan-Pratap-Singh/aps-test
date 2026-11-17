/**
 * ETF Arbitrage game (engine v1.0). Synthetic data; all prices integer cents.
 *
 * - 4 constituents (one quoted in EUR with an FX rate) follow seeded random walks.
 * - ETF NAV = Σ shares_i × price_i × fx_i. The ETF trades at NAV × (1 + premium) where the premium is a
 *   mean-reverting (AR(1)) process with occasional dislocation shocks.
 * - Three AI arbitrageurs watch the net edge; each trades once the edge exceeds its threshold for
 *   `reaction` consecutive ticks, which compresses the premium (they compete for the same opportunity).
 * - Player actions (applied at the current tick):
 *     arb_rich  : sell ETF at bid, buy basket at constituent asks (legging: basket leg fills NEXT tick)
 *     arb_cheap : buy ETF at ask, sell basket at constituent bids (basket leg next tick)
 *     unwind    : flatten both legs at current prices
 * - Depth: the first `depth` units per tick fill at the touch; extra units pay impact per unit.
 * - Costs: per-unit ETF fee + basket fee in bps; tracked separately from gross P&L.
 * - Inventory limit on ETF units.
 */
import { rngFor, type GameDef } from "./framework";

export interface Constituent { sym: string; shares: number; price: number; halfSpread: number; fx: number; ccy: "USD" | "EUR" }

export interface EtfConfig { ticks: number; depth: number; impactPerUnit: number; feePerUnit: number; basketFeeBps: number; maxUnits: number; shockProb: number; botThresholds: number[]; botReaction: number[] }

export function etfConfig(d: number): EtfConfig {
  return {
    ticks: 60, depth: d <= 4 ? 5 : 3, impactPerUnit: 2 + d, feePerUnit: 2, basketFeeBps: 1, maxUnits: d <= 5 ? 10 : 6,
    shockProb: 0.08, botThresholds: [8, 14, 20].map((x) => x - Math.min(6, d)), botReaction: d <= 3 ? [4, 6, 8] : d <= 7 ? [2, 4, 6] : [1, 2, 3],
  };
}

export interface EtfTickView { t: number; nav: number; navBid: number; navAsk: number; etfBid: number; etfAsk: number; edgeRich: number; edgeCheap: number; bestEdge: number }

export interface EtfState {
  seed: number; difficulty: number; cfg: EtfConfig;
  t: number; premiumBps: number; cons: Constituent[]; fxEur: number;
  etfUnits: number; basketUnits: number; cash: number; costs: number;
  pendingBasket: { units: number; tick: number } | null; // legging
  botCounters: number[]; botTrades: number;
  history: EtfTickView[];
  trades: { t: number; kind: "arb_rich" | "arb_cheap" | "unwind"; units: number; quotedEdge: number; realisedEdge: number | null }[];
  missedEdge: number; missedTicks: number; over: boolean;
}

export type EtfAction = { type: "tick" } | { type: "arb_rich"; units: number } | { type: "arb_cheap"; units: number } | { type: "unwind" };

const BASE: Omit<Constituent, "fx">[] = [
  { sym: "ALFA", shares: 0.4, price: 15000, halfSpread: 2, ccy: "USD" },
  { sym: "BRVO", shares: 0.3, price: 8000, halfSpread: 2, ccy: "USD" },
  { sym: "CHLE", shares: 0.2, price: 4000, halfSpread: 1, ccy: "USD" },
  { sym: "DLTA", shares: 0.5, price: 3000, halfSpread: 2, ccy: "EUR" },
];

export function navOf(cons: Constituent[], side: "bid" | "mid" | "ask"): number {
  return Math.round(cons.reduce((a, c) => a + c.shares * c.fx * (side === "mid" ? c.price : side === "bid" ? c.price - c.halfSpread : c.price + c.halfSpread), 0));
}

export function view(s: Pick<EtfState, "cons" | "premiumBps" | "t" | "cfg">): EtfTickView {
  const nav = navOf(s.cons, "mid"), navBid = navOf(s.cons, "bid"), navAsk = navOf(s.cons, "ask");
  const etfMid = Math.round(nav * (1 + s.premiumBps / 10000));
  const etfBid = etfMid - 3, etfAsk = etfMid + 3;
  const fee = s.cfg.feePerUnit + Math.round((nav * s.cfg.basketFeeBps) / 10000);
  const edgeRich = etfBid - navAsk - fee; // sell ETF / buy basket
  const edgeCheap = navBid - etfAsk - fee; // buy ETF / sell basket
  return { t: s.t, nav, navBid, navAsk, etfBid, etfAsk, edgeRich, edgeCheap, bestEdge: Math.max(edgeRich, edgeCheap) };
}

function step(s: EtfState): EtfState {
  const r = rngFor(s.seed, "etf", s.t);
  const fxEur = Math.max(0.9, Math.min(1.3, s.fxEur * (1 + r.normal() * 0.0004)));
  const cons = s.cons.map((c) => ({ ...c, price: Math.max(100, Math.round(c.price * (1 + r.normal() * 0.0012))), fx: c.ccy === "EUR" ? fxEur : 1 }));
  let premium = 0.75 * s.premiumBps + r.normal() * 1.5;
  if (r.next() < s.cfg.shockProb) premium += (r.bool() ? 1 : -1) * (15 + r.next() * 25);
  let next: EtfState = { ...s, t: s.t + 1, cons, fxEur, premiumBps: premium };
  // AI arbitrageurs
  const v = view(next);
  const counters = next.botCounters.map((c, i) => (v.bestEdge > (next.cfg.botThresholds[i] as number) ? c + 1 : 0));
  let botTrades = next.botTrades;
  counters.forEach((c, i) => {
    if (c >= (next.cfg.botReaction[i] as number)) { premium *= 0.45; counters[i] = 0; botTrades++; }
  });
  next = { ...next, premiumBps: premium, botCounters: counters, botTrades };
  // settle pending basket leg at this tick's prices (legging risk)
  if (next.pendingBasket) {
    const pb = next.pendingBasket;
    const px = pb.units > 0 ? navOf(next.cons, "ask") : navOf(next.cons, "bid");
    const fee = Math.round((Math.abs(pb.units) * px * next.cfg.basketFeeBps) / 10000);
    next = { ...next, basketUnits: next.basketUnits + pb.units, cash: next.cash - pb.units * px - fee, costs: next.costs + fee, pendingBasket: null };
    const tr = [...next.trades];
    const last = tr[tr.length - 1];
    if (last && last.realisedEdge === null) {
      const etfPx = last.kind === "arb_rich" ? s.history[s.history.length - 1]?.etfBid ?? 0 : s.history[s.history.length - 1]?.etfAsk ?? 0;
      const realisedEdge = last.kind === "arb_rich" ? etfPx - px : px - etfPx;
      tr[tr.length - 1] = { ...last, realisedEdge: realisedEdge - next.cfg.feePerUnit - Math.round((px * next.cfg.basketFeeBps) / 10000) };
      next = { ...next, trades: tr };
    }
  }
  const nv = view(next);
  return { ...next, history: [...next.history, nv], over: next.t >= next.cfg.ticks };
}

export const EtfGame: GameDef<EtfState, EtfAction> = {
  type: "etf_arbitrage",
  version: "1.0",
  init(seed, difficulty) {
    const cfg = etfConfig(difficulty);
    const cons = BASE.map((c) => ({ ...c, fx: c.ccy === "EUR" ? 1.08 : 1 }));
    const s: EtfState = { seed, difficulty, cfg, t: 0, premiumBps: 0, cons, fxEur: 1.08, etfUnits: 0, basketUnits: 0, cash: 0, costs: 0, pendingBasket: null,
      botCounters: [0, 0, 0], botTrades: 0, history: [], trades: [], missedEdge: 0, missedTicks: 0, over: false };
    return { ...s, history: [view(s)] };
  },
  reduce(s, a) {
    if (s.over) return s;
    const v = s.history[s.history.length - 1] ?? view(s);
    if (a.type === "tick") {
      const traded = s.trades.some((tr) => tr.t === s.t);
      const missed = !traded && v.bestEdge > 0 && Math.abs(s.etfUnits) < s.cfg.maxUnits;
      return step({ ...s, missedEdge: s.missedEdge + (missed ? v.bestEdge : 0), missedTicks: s.missedTicks + (missed ? 1 : 0) });
    }
    if (s.pendingBasket) return s; // one leg in flight: cannot trade until it settles
    if (a.type === "unwind") {
      if (s.etfUnits === 0 && s.basketUnits === 0) return s;
      const etfPx = s.etfUnits > 0 ? v.etfBid : v.etfAsk;
      const bPx = s.basketUnits > 0 ? v.navBid : v.navAsk;
      const fee = Math.abs(s.etfUnits) * s.cfg.feePerUnit + Math.round((Math.abs(s.basketUnits) * bPx * s.cfg.basketFeeBps) / 10000);
      return { ...s, cash: s.cash + s.etfUnits * etfPx + s.basketUnits * bPx - fee, costs: s.costs + fee, etfUnits: 0, basketUnits: 0,
        trades: [...s.trades, { t: s.t, kind: "unwind", units: s.etfUnits, quotedEdge: 0, realisedEdge: 0 }] };
    }
    const units = Math.max(1, Math.min(5, Math.floor(a.units)));
    const dir = a.type === "arb_rich" ? -1 : 1; // ETF direction
    const allowed = Math.min(units, s.cfg.maxUnits - dir * s.etfUnits);
    if (allowed <= 0) return s;
    const touch = dir < 0 ? v.etfBid : v.etfAsk;
    let etfCash = 0;
    for (let i = 0; i < allowed; i++) {
      const impact = i < s.cfg.depth ? 0 : (i - s.cfg.depth + 1) * s.cfg.impactPerUnit;
      etfCash += dir < 0 ? touch - impact : -(touch + impact);
    }
    const impactCost = Math.abs(etfCash) - allowed * touch;
    const fee = allowed * s.cfg.feePerUnit;
    return {
      ...s, cash: s.cash + etfCash - fee, costs: s.costs + fee + Math.abs(impactCost), etfUnits: s.etfUnits + dir * allowed,
      pendingBasket: { units: -dir * allowed, tick: s.t + 1 },
      trades: [...s.trades, { t: s.t, kind: a.type, units: allowed, quotedEdge: dir < 0 ? v.edgeRich : v.edgeCheap, realisedEdge: null }],
    };
  },
  isOver: (s) => s.over,
};

export interface EtfSummary { netPnl: number; grossPnl: number; costs: number; exposure: number; maxExposure: number; trades: number; avgQuotedEdge: number; avgRealisedEdge: number; missedEdge: number; missedTicks: number; botTrades: number; riskAdjusted: number; score: number }

export function summarizeEtf(s: EtfState): EtfSummary {
  const v = s.history[s.history.length - 1] ?? view(s);
  const etfMid = (v.etfBid + v.etfAsk) / 2;
  const net = s.cash + s.etfUnits * etfMid + s.basketUnits * v.nav;
  const arbs = s.trades.filter((t) => t.kind !== "unwind");
  const realisedEdges = arbs.filter((t) => t.realisedEdge !== null).map((t) => (t.realisedEdge as number) * t.units);
  // exposure path: |ETF units + basket units| (net unhedged units)
  const exposures = [Math.abs(s.etfUnits + s.basketUnits)];
  const maxExp = Math.max(...exposures, ...arbs.map((t) => t.units));
  const riskAdjusted = net / Math.max(1, Math.sqrt(1 + maxExp));
  const score = Math.max(0, Math.min(100, 50 + 50 * Math.tanh(net / 400) - Math.min(20, s.missedTicks)));
  return {
    netPnl: net, grossPnl: net + s.costs, costs: s.costs, exposure: s.etfUnits + s.basketUnits, maxExposure: maxExp, trades: arbs.length,
    avgQuotedEdge: arbs.length ? arbs.reduce((a, t) => a + t.quotedEdge, 0) / arbs.length : 0,
    avgRealisedEdge: realisedEdges.length ? realisedEdges.reduce((a, b) => a + b, 0) / arbs.reduce((a, t) => a + t.units, 0) : 0,
    missedEdge: s.missedEdge, missedTicks: s.missedTicks, botTrades: s.botTrades, riskAdjusted, score,
  };
}
