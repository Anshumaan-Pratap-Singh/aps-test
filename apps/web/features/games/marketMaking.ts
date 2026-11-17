/**
 * Market-Making Dice / Cards game (engine v1.0).
 *
 * Rules
 * - A hidden quantity X is the sum of N dice (or N cards drawn without replacement, A=1 … K=13).
 * - The contract settles at X points; 1 point = 100 cents per lot.
 * - Each round one more die/card is revealed, then the player posts a two-sided quote (bid < ask, prices in 0.1-point ticks).
 * - Counterparties arrive. With probability τ (toxicity) a trader is informed (knows X); otherwise they hold a noisy
 *   estimate of the current fair value. A trader buys at the ask if their value > ask, sells at the bid if value < bid.
 * - Each fill is 1 lot. Fills that would breach the inventory limit are refused and counted as risk-limit hits.
 * - After the final round the contract settles at X. P&L = cash + inventory × X.
 *
 * Fair value E[X | revealed] is computed exactly. Uncertainty σ is the exact standard deviation of the unrevealed part.
 */
import { applyFill, mtm, newLedger, realised, rngFor, type GameDef, type Ledger } from "./framework";

export const TICK = 10; // cents (0.1 point)
export const POINT = 100; // cents per point

export interface MMConfig { variant: "dice" | "cards"; n: number; rounds: number; flowPerRound: number; toxicity: number; noise: number; maxInventory: number }

export function mmConfig(difficulty: number, variant: "dice" | "cards" = "dice"): MMConfig {
  const d = Math.max(1, Math.min(10, difficulty));
  return {
    variant, n: d <= 3 ? 4 : d <= 7 ? 5 : 6,
    rounds: d <= 3 ? 3 : d <= 7 ? 4 : 5, // = n − 1: at least one value is still hidden at every quote
    flowPerRound: 4 + Math.floor(d / 2), toxicity: 0.1 + 0.04 * d, noise: 1.5 + 0.2 * d, maxInventory: d <= 5 ? 6 : 4,
  };
}

export interface MMRound {
  index: number;
  fairBefore: number; // cents, E[X | revealed]
  sigma: number; // points
  bid: number; ask: number; // cents
  fills: { side: "buy" | "sell"; price: number; informed: boolean }[]; // side from the MAKER's perspective
  refused: number;
  modelBid: number; modelAsk: number;
}

export interface MMState {
  seed: number; difficulty: number; cfg: MMConfig;
  hidden: number[]; // all N values, fixed at init
  revealed: number; // count revealed
  round: number;
  ledger: Ledger;
  rounds: MMRound[];
  over: boolean;
  invalidQuotes: number;
}

export type MMAction = { type: "quote"; bid: number; ask: number } | { type: "end" };

function drawHidden(seed: number, cfg: MMConfig): number[] {
  const r = rngFor(seed, "mm-hidden");
  if (cfg.variant === "dice") return Array.from({ length: cfg.n }, () => r.int(1, 6));
  const deck: number[] = [];
  for (let v = 1; v <= 13; v++) for (let s = 0; s < 4; s++) deck.push(v);
  return r.shuffle(deck).slice(0, cfg.n);
}

/** Exact E[X | revealed] in cents, and σ of the unrevealed remainder in points. */
export function fairValue(s: Pick<MMState, "hidden" | "revealed" | "cfg">): { fair: number; sigma: number } {
  const shown = s.hidden.slice(0, s.revealed);
  const k = s.cfg.n - s.revealed;
  const shownSum = shown.reduce((a, b) => a + b, 0);
  if (s.cfg.variant === "dice") return { fair: (shownSum + 3.5 * k) * POINT, sigma: Math.sqrt((k * 35) / 12) };
  // cards: remaining deck after removing revealed cards
  const counts = new Map<number, number>();
  for (let v = 1; v <= 13; v++) counts.set(v, 4);
  for (const c of shown) counts.set(c, (counts.get(c) as number) - 1);
  const M = 52 - shown.length;
  let sum = 0, sumSq = 0;
  for (const [v, c] of counts) { sum += v * c; sumSq += v * v * c; }
  const mu = sum / M, popVar = sumSq / M - mu * mu;
  const variance = k > 0 ? k * popVar * ((M - k) / (M - 1)) : 0; // finite-population correction
  return { fair: Math.round((shownSum + k * mu) * POINT), sigma: Math.sqrt(variance) };
}

/** Reference-model parameters (points): h = H0 + K_SIGMA·σ + K_TOX·τ·σ ; skew = GAMMA·q·σ². */
export const MODEL = { H0: 0.2, K_SIGMA: 0.25, K_TOX: 0.5, GAMMA: 0.05 } as const;

/** Reference quote from the APS quoting model (see Market Making lesson). */
export function modelQuote(fairCents: number, sigma: number, inventory: number, toxicity: number): { bid: number; ask: number } {
  const half = Math.max(TICK, Math.round((MODEL.H0 + MODEL.K_SIGMA * sigma + MODEL.K_TOX * toxicity * sigma) * POINT));
  const skew = MODEL.GAMMA * inventory * sigma * sigma * POINT;
  const mid = fairCents - skew;
  let bid = Math.floor((mid - half) / TICK) * TICK, ask = Math.ceil((mid + half) / TICK) * TICK;
  if (ask <= bid) ask = bid + TICK;
  return { bid, ask };
}

export const MarketMakingGame: GameDef<MMState, MMAction> = {
  type: "market_making",
  version: "1.0",
  init(seed, difficulty) {
    const cfg = mmConfig(difficulty, seed % 2 === 0 ? "dice" : "cards");
    return { seed, difficulty, cfg, hidden: drawHidden(seed, cfg), revealed: 1, round: 0, ledger: newLedger(), rounds: [], over: false, invalidQuotes: 0 };
  },
  reduce(s, a) {
    if (s.over) return s;
    if (a.type === "end") return { ...s, over: true, revealed: s.cfg.n };
    const { bid, ask } = a;
    if (!Number.isInteger(bid) || !Number.isInteger(ask) || bid % TICK || ask % TICK || ask <= bid || bid < 0) {
      return { ...s, invalidQuotes: s.invalidQuotes + 1 };
    }
    const { fair, sigma } = fairValue(s);
    const truth = s.hidden.reduce((x, y) => x + y, 0) * POINT;
    const r = rngFor(s.seed, "mm-flow", s.round);
    let ledger = s.ledger;
    const fills: MMRound["fills"] = [];
    let refused = 0;
    for (let i = 0; i < s.cfg.flowPerRound; i++) {
      const informed = r.next() < s.cfg.toxicity;
      const value = informed ? truth : fair + r.normal() * s.cfg.noise * POINT * 0.5;
      const buyIntent = value > ask, sellIntent = value < bid;
      // uninformed traders only trade with some probability (liquidity demand), informed always when profitable
      const willing = informed || r.next() < 0.7;
      if (!willing) continue;
      if (buyIntent) {
        if (ledger.qty - 1 < -s.cfg.maxInventory) { refused++; continue; }
        ledger = applyFill(ledger, -1, ask); fills.push({ side: "sell", price: ask, informed });
      } else if (sellIntent) {
        if (ledger.qty + 1 > s.cfg.maxInventory) { refused++; continue; }
        ledger = applyFill(ledger, 1, bid); fills.push({ side: "buy", price: bid, informed });
      }
    }
    const model = modelQuote(fair, sigma, s.ledger.qty, s.cfg.toxicity);
    const round: MMRound = { index: s.round, fairBefore: fair, sigma, bid, ask, fills, refused, modelBid: model.bid, modelAsk: model.ask };
    const nextRound = s.round + 1;
    const over = nextRound >= s.cfg.rounds;
    return { ...s, ledger, rounds: [...s.rounds, round], round: nextRound, revealed: over ? s.cfg.n : Math.min(s.cfg.n, s.revealed + 1), over };
  },
  isOver: (s) => s.over,
};

export interface MMSummary {
  settlement: number; pnl: number; realisedPnl: number; spreadCaptured: number; adverseSelection: number; avgAbsInventory: number;
  maxAbsInventory: number; riskHits: number; quoteError: number; avgWidth: number; fills: number; informedShare: number; score: number;
  benchmarkPnl: number;
}

/** Metric definitions (all cents unless noted). */
export function summarize(s: MMState): MMSummary {
  const settle = s.hidden.reduce((a, b) => a + b, 0) * POINT;
  const allFills = s.rounds.flatMap((r) => r.fills.map((f) => ({ ...f, fair: r.fairBefore })));
  // spread captured: edge vs fair value at the time of the fill
  const spreadCaptured = allFills.reduce((a, f) => a + (f.side === "sell" ? f.price - f.fair : f.fair - f.price), 0);
  // adverse selection: markout to settlement minus the edge vs then-fair (how much value moved against fills)
  const markout = allFills.reduce((a, f) => a + (f.side === "buy" ? settle - f.price : f.price - settle), 0);
  const adverse = spreadCaptured - markout; // positive = lost to informed flow
  let inv = 0; const invs: number[] = [];
  for (const r of s.rounds) { for (const f of r.fills) inv += f.side === "buy" ? 1 : -1; invs.push(Math.abs(inv)); }
  const pnl = mtm(s.ledger, settle);
  const quoteError = s.rounds.length ? s.rounds.reduce((a, r) => a + Math.abs((r.bid + r.ask) / 2 - r.fairBefore), 0) / s.rounds.length : 0;
  const avgWidth = s.rounds.length ? s.rounds.reduce((a, r) => a + (r.ask - r.bid), 0) / s.rounds.length : 0;
  const riskHits = s.rounds.reduce((a, r) => a + r.refused, 0);
  const benchmark = benchmarkPnl(s);
  // Score: P&L relative to the reference maker on identical flow, scaled by settlement uncertainty; −3 per risk-limit hit.
  const scale = Math.max(1, fairValue({ ...s, revealed: 1 }).sigma * POINT);
  const score = Math.max(0, Math.min(100, 50 + 40 * Math.tanh((pnl - benchmark) / scale) + 10 * Math.tanh(spreadCaptured / scale) - 3 * riskHits - 2 * s.invalidQuotes));
  return {
    settlement: settle, pnl, realisedPnl: realised(s.ledger).toNumber(), spreadCaptured, adverseSelection: adverse,
    avgAbsInventory: invs.length ? invs.reduce((a, b) => a + b, 0) / invs.length : 0, maxAbsInventory: Math.max(0, ...invs),
    riskHits, quoteError, avgWidth, fills: allFills.length, informedShare: allFills.length ? allFills.filter((f) => f.informed).length / allFills.length : 0,
    score, benchmarkPnl: benchmark,
  };
}

/** P&L of the reference model quoting on the same seed (same flow draws). */
export function benchmarkPnl(s: MMState): number {
  let b = MarketMakingGame.init(s.seed, s.difficulty);
  while (!b.over) {
    const { fair, sigma } = fairValue(b);
    const q = modelQuote(fair, sigma, b.ledger.qty, b.cfg.toxicity);
    b = MarketMakingGame.reduce(b, { type: "quote", ...q });
  }
  return mtm(b.ledger, b.hidden.reduce((x, y) => x + y, 0) * POINT);
}

export function explainRound(r: MMRound, inventoryBefore: number): string {
  const mid = (r.bid + r.ask) / 2, width = r.ask - r.bid;
  const parts: string[] = [];
  const off = (mid - r.fairBefore) / POINT;
  if (Math.abs(off) > r.sigma * 0.5) parts.push(`mid ${off > 0 ? "above" : "below"} fair by ${Math.abs(off).toFixed(1)} pts (σ=${r.sigma.toFixed(1)}): you invited ${off > 0 ? "sellers" : "buyers"}`);
  else parts.push(`mid within ${Math.abs(off).toFixed(1)} pts of fair`);
  const modelWidth = r.modelAsk - r.modelBid;
  if (width < modelWidth * 0.6) parts.push(`width ${(width / POINT).toFixed(1)} is tight for this uncertainty (model ${(modelWidth / POINT).toFixed(1)}) — exposed to informed flow`);
  else if (width > modelWidth * 1.8) parts.push(`width ${(width / POINT).toFixed(1)} is wide (model ${(modelWidth / POINT).toFixed(1)}) — safe but few fills`);
  if (inventoryBefore !== 0 && Math.sign(mid - r.fairBefore) === Math.sign(inventoryBefore)) parts.push(`quotes skewed the wrong way for inventory ${inventoryBefore > 0 ? "+" : ""}${inventoryBefore}`);
  if (r.refused) parts.push(`${r.refused} fill(s) refused at the risk limit`);
  return parts.join("; ") + ".";
}
