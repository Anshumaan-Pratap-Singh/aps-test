/**
 * Event Contracts game (engine v1.0).
 *
 * A binary contract pays 100 points (= $1.00 per point… displayed as 0–100) if the event occurs.
 * - Outcome Y ~ Bernoulli(prior), drawn at init from the seed.
 * - Each round a news signal arrives with stated reliability r: P(says YES | Y=1) = r, P(says YES | Y=0) = 1 − r.
 * - Fair probability is the exact Bayesian posterior; logit(p') = logit(p) ± ln(r/(1−r)).
 * - The player quotes bid/ask in contract points (integers 1–99). Flow: informed traders (prob τ) know Y;
 *   noise traders value the contract at posterior + noise. Fill rules as in the dice game.
 * - Settlement: 100 × Y per long contract.
 */
import { applyFill, mtm, newLedger, rngFor, type GameDef, type Ledger } from "./framework";

export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (x: number) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
export const clampP = (p: number, eps = 1e-4) => Math.min(1 - eps, Math.max(eps, p));

export function bayesUpdate(prior: number, reliability: number, saysYes: boolean): number {
  if (!(reliability >= 0.5 && reliability < 1)) throw new RangeError("reliability must be in [0.5, 1)");
  const lr = Math.log(reliability / (1 - reliability));
  return clampP(sigmoid(logit(clampP(prior)) + (saysYes ? lr : -lr)));
}

export interface Signal { reliability: number; saysYes: boolean; headline: string }
export interface EvRound { index: number; posterior: number; bid: number; ask: number; fills: { side: "buy" | "sell"; price: number; informed: boolean }[]; refused: number; signal: Signal }

export interface EvState {
  seed: number; difficulty: number; prior: number; outcome: boolean; signals: Signal[]; round: number; rounds: number;
  posterior: number; toxicity: number; flow: number; maxInventory: number; ledger: Ledger; history: EvRound[]; over: boolean; invalid: number; title: string;
}

export type EvAction = { type: "quote"; bid: number; ask: number };

const EVENTS = [
  "Synthetic Co. beats earnings consensus", "Central bank of Arcadia cuts rates", "Merger between two synthetic firms closes",
  "Product launch ships on schedule", "Index rebalancing includes ticker ZETA",
];

export const EventGame: GameDef<EvState, EvAction> = {
  type: "event_contracts",
  version: "1.0",
  init(seed, difficulty) {
    const r = rngFor(seed, "ev-init");
    const prior = Math.round((0.2 + r.next() * 0.6) * 100) / 100;
    const outcome = r.next() < prior;
    const rounds = difficulty <= 3 ? 4 : difficulty <= 7 ? 5 : 6;
    const signals: Signal[] = Array.from({ length: rounds }, (_, i) => {
      const reliability = Math.round((0.55 + r.next() * (difficulty <= 3 ? 0.35 : 0.3)) * 100) / 100;
      const saysYes = outcome ? r.next() < reliability : r.next() >= reliability;
      return { reliability, saysYes, headline: `Report ${i + 1}: source (reliability ${Math.round(reliability * 100)}%) says ${saysYes ? "YES" : "NO"}` };
    });
    return { seed, difficulty, prior, outcome, signals, round: 0, rounds, posterior: prior, toxicity: 0.1 + 0.04 * difficulty,
      flow: 5 + Math.floor(difficulty / 2), maxInventory: 8, ledger: newLedger(), history: [], over: false, invalid: 0, title: r.pick(EVENTS) };
  },
  reduce(s, a) {
    if (s.over) return s;
    const { bid, ask } = a;
    if (!Number.isInteger(bid) || !Number.isInteger(ask) || bid < 0 || ask > 100 || ask <= bid) return { ...s, invalid: s.invalid + 1 };
    // the round's signal is revealed before quoting
    const sig = s.signals[s.round] as Signal;
    const posterior = bayesUpdate(s.posterior, sig.reliability, sig.saysYes);
    const r = rngFor(s.seed, "ev-flow", s.round);
    let ledger = s.ledger;
    const fills: EvRound["fills"] = [];
    let refused = 0;
    for (let i = 0; i < s.flow; i++) {
      const informed = r.next() < s.toxicity;
      const value = informed ? (s.outcome ? 100 : 0) : posterior * 100 + r.normal() * 8;
      if (!(informed || r.next() < 0.7)) continue;
      if (value > ask) {
        if (ledger.qty - 1 < -s.maxInventory) { refused++; continue; }
        ledger = applyFill(ledger, -1, ask); fills.push({ side: "sell", price: ask, informed });
      } else if (value < bid) {
        if (ledger.qty + 1 > s.maxInventory) { refused++; continue; }
        ledger = applyFill(ledger, 1, bid); fills.push({ side: "buy", price: bid, informed });
      }
    }
    const round: EvRound = { index: s.round, posterior, bid, ask, fills, refused, signal: sig };
    const next = s.round + 1;
    return { ...s, ledger, posterior, round: next, history: [...s.history, round], over: next >= s.rounds };
  },
  isOver: (s) => s.over,
};

/** Posterior that will apply to the next quote (after revealing the pending signal). */
export const pendingPosterior = (s: EvState) => (s.over ? s.posterior : bayesUpdate(s.posterior, (s.signals[s.round] as Signal).reliability, (s.signals[s.round] as Signal).saysYes));

export function explainEventQuote(r: EvRound, inventoryBefore: number): string {
  const fair = r.posterior * 100, mid = (r.bid + r.ask) / 2, width = r.ask - r.bid;
  const unc = Math.sqrt(r.posterior * (1 - r.posterior)) * 100; // Bernoulli s.d. in points
  const parts = [`fair ${fair.toFixed(1)}, your mid ${mid.toFixed(1)}`];
  if (Math.abs(mid - fair) > 8) parts.push(`mid is ${Math.abs(mid - fair).toFixed(0)} points ${mid > fair ? "rich" : "cheap"} — informed and noise flow both pick you off`);
  const target = 2 + 0.25 * unc;
  if (width < target * 0.6) parts.push(`width ${width} is narrow for outcome s.d. ${unc.toFixed(0)} (suggest ≈${target.toFixed(0)})`);
  if (width > target * 2.5) parts.push(`width ${width} is very wide; little flow will trade`);
  if (inventoryBefore && Math.sign(mid - fair) === Math.sign(inventoryBefore)) parts.push(`skew works against inventory ${inventoryBefore > 0 ? "+" : ""}${inventoryBefore}`);
  return parts.join("; ") + ".";
}

export function summarizeEvents(s: EvState) {
  const settle = s.outcome ? 100 : 0;
  const pnl = mtm(s.ledger, settle);
  const fills = s.history.flatMap((r) => r.fills.map((f) => ({ ...f, fair: r.posterior * 100 })));
  const edge = fills.reduce((a, f) => a + (f.side === "sell" ? f.price - f.fair : f.fair - f.price), 0);
  const quoteErr = s.history.length ? s.history.reduce((a, r) => a + Math.abs((r.bid + r.ask) / 2 - r.posterior * 100), 0) / s.history.length : 0;
  // Score on decision quality (edge vs Bayesian fair at the time), not on the realised coin flip.
  const score = Math.max(0, Math.min(100, 50 + 35 * Math.tanh(edge / 40) + 15 * Math.tanh((10 - quoteErr) / 10) - 3 * s.history.reduce((a, r) => a + r.refused, 0) - 2 * s.invalid));
  return { settle, pnl, edgeVsFair: edge, quoteError: quoteErr, fills: fills.length, score };
}
