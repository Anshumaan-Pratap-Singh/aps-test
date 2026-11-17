/**
 * Shared game framework. A game is a pure, deterministic reducer:
 *
 *   state_{k+1} = reduce(state_k, action_k)
 *
 * All randomness is derived from (seed, step, purpose) via a fresh Rng, never
 * from Math.random, so a game is fully reproducible from (seed, difficulty,
 * actions). Money is integer cents (fixed-point); no float equality on money.
 */
import { Q } from "@/lib/rational";
import { Rng } from "@/lib/rng";

export interface GameDef<S, A extends { type: string }> {
  type: string;
  version: string;
  init: (seed: number, difficulty: number) => S;
  reduce: (state: S, action: A) => S;
  isOver: (state: S) => boolean;
}

export interface LoggedAction<A> { seq: number; t: number; action: A }

export function replay<S, A extends { type: string }>(def: GameDef<S, A>, seed: number, difficulty: number, log: LoggedAction<A>[]): S {
  return log.reduce((s, e) => def.reduce(s, e.action), def.init(seed, difficulty));
}

export const rngFor = (seed: number, ...parts: (string | number)[]) => new Rng(`${seed}:${parts.join(":")}`);

/** Format integer cents as a currency string. */
export const fmtCents = (c: number, dp = 2) => `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toFixed(dp)}`;

/**
 * Position ledger. Cash and prices are integer cents. The open position's cost
 * basis is an exact rational (average-cost accounting can create fractional
 * cents), so the identity  mtm = realised + unrealised  holds exactly:
 *
 *   realised   = cash + basis
 *   unrealised = qty·mark − basis
 *   mtm        = cash + qty·mark
 */
export interface Ledger { qty: number; cash: number; basis: Q; fills: number; volume: number }

export const newLedger = (): Ledger => ({ qty: 0, cash: 0, basis: new Q(0), fills: 0, volume: 0 });

/** Apply a fill of `qty` (positive = buy, negative = sell) at integer price `price` (cents). */
export function applyFill(l: Ledger, qty: number, price: number): Ledger {
  if (!Number.isInteger(qty) || qty === 0 || !Number.isInteger(price)) throw new Error("fills use integer qty and integer cents");
  const cash = l.cash - qty * price;
  let basis = l.basis;
  if (l.qty === 0 || Math.sign(l.qty) === Math.sign(qty)) {
    basis = basis.add(new Q(qty * price));
  } else {
    const closing = Math.min(Math.abs(qty), Math.abs(l.qty));
    basis = basis.sub(basis.mul(new Q(closing, Math.abs(l.qty))));
    const remaining = Math.abs(qty) - closing;
    if (remaining > 0) basis = new Q(Math.sign(qty) * remaining * price);
  }
  const q = l.qty + qty;
  if (q === 0) basis = new Q(0);
  return { qty: q, cash, basis, fills: l.fills + 1, volume: l.volume + Math.abs(qty) };
}

export const mtm = (l: Ledger, mark: number) => l.cash + l.qty * mark;
export const realised = (l: Ledger) => new Q(l.cash).add(l.basis);
export const unrealised = (l: Ledger, mark: number) => new Q(l.qty * mark).sub(l.basis);
export const avgCost = (l: Ledger) => (l.qty === 0 ? null : l.basis.div(new Q(l.qty)).toNumber());
