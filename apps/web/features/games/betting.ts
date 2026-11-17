/**
 * Betting Board (educational probability simulation — no real money).
 *
 * Each event has an exactly computable fair probability (dice, coins, cards). The
 * board quotes decimal odds with a bookmaker margin plus seeded mispricings, so
 * some bets are +EV. The player stakes from a virtual bankroll.
 *
 * Scoring is on decision quality, not luck: score = 100 × (EV captured) / (EV of
 * the half-Kelly benchmark with a 5% cap), minus penalties for −EV bets and for
 * staking above full Kelly. Realised P&L from simulated outcomes is shown separately.
 */
import { q, Q } from "@/lib/rational";
import { rngFor } from "./framework";

export interface BoardEvent { id: string; text: string; p: Q; odds: number; resolve: (seed: number) => boolean }

function comb(n: number, k: number): number { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); }

const TEMPLATES: { id: string; text: string; p: Q; sim: (r: ReturnType<typeof rngFor>) => boolean }[] = [
  { id: "dice9", text: "Two dice sum to 9 or more", p: q(10, 36), sim: (r) => r.int(1, 6) + r.int(1, 6) >= 9 },
  { id: "six4", text: "At least one six in four rolls", p: q(671, 1296), sim: (r) => [0, 0, 0, 0].some(() => r.int(1, 6) === 6) },
  { id: "suit2", text: "Two cards drawn are the same suit", p: q(12, 51), sim: (r) => { const a = r.int(0, 51); let b = r.int(0, 50); if (b >= a) b++; return a % 4 === b % 4; } },
  { id: "h3of5", text: "Exactly 3 heads in 5 flips", p: q(comb(5, 3), 32), sim: (r) => [0, 0, 0, 0, 0].filter(() => r.bool()).length === 3 },
  { id: "aceking", text: "A single card is an ace or a king", p: q(8, 52), sim: (r) => r.int(0, 51) % 13 < 2 },
  { id: "norepeat3", text: "Three dice all show different faces", p: q(120, 216), sim: (r) => new Set([r.int(1, 6), r.int(1, 6), r.int(1, 6)]).size === 3 },
  { id: "sum10", text: "Three dice sum to exactly 10", p: q(27, 216), sim: (r) => r.int(1, 6) + r.int(1, 6) + r.int(1, 6) === 10 },
  { id: "firstH3", text: "First head appears on flip 3 or later", p: q(1, 4), sim: (r) => !r.bool() && !r.bool() },
  { id: "pair3", text: "Among three dice, at least two match", p: q(96, 216), sim: (r) => new Set([r.int(1, 6), r.int(1, 6), r.int(1, 6)]).size < 3 },
  { id: "doubles", text: "Rolling doubles with two dice", p: q(1, 6), sim: (r) => r.int(1, 6) === r.int(1, 6) },
];

export function makeBoard(seed: number, difficulty: number, n = 6): BoardEvent[] {
  const r = rngFor(seed, "board");
  const picks = r.shuffle([...TEMPLATES]).slice(0, n);
  const margin = 0.05;
  return picks.map((t) => {
    // fair decimal odds = 1/p; quoted = fair × (1 − margin) × mispricing, mispricing ∈ [0.85, 1.2] narrowing with difficulty
    const spread = 0.2 - 0.012 * difficulty;
    const mis = 1 + (r.next() * 2 - 1) * spread;
    const odds = Math.max(1.01, Math.round((1 / t.p.toNumber()) * (1 - margin) * mis * 100) / 100);
    return { id: t.id, text: t.text, p: t.p, odds, resolve: (s: number) => t.sim(rngFor(s, "resolve", t.id)) };
  });
}

export const evPerUnit = (p: number, odds: number) => p * (odds - 1) - (1 - p);
export const kelly = (p: number, odds: number) => Math.max(0, (p * (odds - 1) - (1 - p)) / (odds - 1));
export const impliedP = (odds: number) => 1 / odds;

export function scoreBoard(board: BoardEvent[], stakes: Record<string, number>, bankroll: number, seed: number) {
  let ev = 0, bench = 0, negEv = 0, overKelly = 0, realised = 0;
  const rows = board.map((e) => {
    const p = e.p.toNumber();
    const stake = Math.max(0, stakes[e.id] ?? 0);
    const e1 = evPerUnit(p, e.odds);
    const k = kelly(p, e.odds);
    const benchStake = bankroll * Math.min(0.05, 0.5 * k);
    ev += stake * e1;
    bench += benchStake * e1;
    if (stake > 0 && e1 < 0) negEv += stake * -e1;
    if (stake > bankroll * k * 1.0001 && stake > 0) overKelly += stake - bankroll * k;
    const won = e.resolve(seed);
    const pnl = stake === 0 ? 0 : won ? stake * (e.odds - 1) : -stake;
    realised += pnl;
    return { id: e.id, text: e.text, p, odds: e.odds, implied: impliedP(e.odds), edge: p - impliedP(e.odds), ev: e1, kelly: k, benchStake, stake, won, pnl };
  });
  const base = bench > 0 ? (100 * ev) / bench : ev >= 0 ? 100 : 0;
  const score = Math.max(0, Math.min(100, base - (100 * negEv) / Math.max(1, bankroll * 0.05) - (50 * overKelly) / Math.max(1, bankroll)));
  return { rows, ev, benchEv: bench, realised, score };
}
