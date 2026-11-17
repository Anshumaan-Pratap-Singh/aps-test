/**
 * Number-sequence families with explicit rules. A candidate is rejected when a
 * simpler model (low-degree polynomial or geometric) fits every shown term but
 * predicts a different next term — i.e. when the puzzle would be ambiguous.
 */
import { Rng } from "@/lib/rng";
import { q, Q } from "@/lib/rational";

export interface SeqCandidate {
  shown: number[];
  next: number;
  explanation: string;
  hints: string[];
  family: string;
  tag: string;
}

function primes(n: number): number[] {
  const out: number[] = [];
  for (let k = 2; out.length < n; k++) if (out.every((p) => p * p > k || k % p !== 0)) out.push(k);
  return out;
}

export function polyNext(terms: Q[], maxDegree: number): Q | null {
  const rows: Q[][] = [terms];
  while ((rows[rows.length - 1] as Q[]).length > 1) {
    const r = rows[rows.length - 1] as Q[];
    rows.push(r.slice(1).map((x, i) => x.sub(r[i] as Q)));
  }
  for (let deg = 0; deg < rows.length; deg++) {
    if (deg > maxDegree) return null;
    const row = rows[deg] as Q[];
    if (row.length < 2) return null;
    if (row.every((x) => x.eq(row[0] as Q))) {
      let nxt = row[row.length - 1] as Q;
      for (let up = deg - 1; up >= 0; up--) { const ur = rows[up] as Q[]; nxt = (ur[ur.length - 1] as Q).add(nxt); }
      return nxt;
    }
  }
  return null;
}

export function geometricNext(terms: Q[]): Q | null {
  if (terms.slice(0, -1).some((t) => t.n === 0n)) return null;
  const ratios = terms.slice(1).map((t, i) => t.div(terms[i] as Q));
  return ratios.every((x) => x.eq(ratios[0] as Q)) ? (terms[terms.length - 1] as Q).mul(ratios[0] as Q) : null;
}

export function isUnambiguous(shown: number[], next: number): boolean {
  const t = shown.map((x) => q(x));
  if (new Set(shown).size === 1) return false;
  const alts = [polyNext(t, Math.min(3, t.length - 3)), geometricNext(t)].filter((x): x is Q => x !== null);
  return alts.every((a) => a.eq(q(next)));
}

type Fam = (r: Rng, d: number) => SeqCandidate;

const FAMILIES: Record<string, [Fam, number]> = {
  arithmetic: [(r, d) => {
    const a = r.int(1, 20 * d);
    let k = 0; while (k === 0) k = r.int(-3 * d - 2, 3 * d + 2);
    const t = Array.from({ length: 6 }, (_, i) => a + k * i);
    return { shown: t.slice(0, 5), next: t[5] as number, explanation: `Arithmetic progression, common difference ${k}.`, hints: ["Look at consecutive differences."], family: "arithmetic", tag: "arithmetic" };
  }, 1],
  geometric: [(r, d) => {
    const a = r.int(1, 5 + d), k = r.pick(d < 6 ? [2, 3, -2] : [2, 3, 4, -3, 5]);
    const t = Array.from({ length: 6 }, (_, i) => a * k ** i);
    return { shown: t.slice(0, 5), next: t[5] as number, explanation: `Geometric progression, common ratio ${k}.`, hints: ["Look at consecutive ratios."], family: "geometric", tag: "geometric" };
  }, 1],
  n_times: [(r, d) => {
    const k = r.int(1, 3 + Math.floor(d / 3)), s = r.int(1, 2);
    const t = Array.from({ length: 6 }, (_, i) => (s + i) * (s + i + k));
    return { shown: t.slice(0, 5), next: t[5] as number, explanation: `Term is n(n+${k}); differences grow by 2.`, hints: ["Differences form an arithmetic sequence."], family: "n_times", tag: "polynomial" };
  }, 2],
  squares_plus: [(r) => {
    const c = r.int(-3, 5), s = r.int(1, 6);
    const t = Array.from({ length: 6 }, (_, i) => (s + i) ** 2 + c);
    return { shown: t.slice(0, 5), next: t[5] as number, explanation: `Perfect squares ${c >= 0 ? "+" : "−"} ${Math.abs(c)}.`, hints: ["Compare with perfect squares."], family: "squares_plus", tag: "polynomial" };
  }, 2],
  quadratic: [(r, d) => {
    const a = r.int(1, 1 + Math.floor(d / 3)), b = r.int(-3, 3 + d), c = r.int(-5, 5 + d), s = r.int(1, 3);
    const t = Array.from({ length: 6 }, (_, i) => a * (s + i) ** 2 + b * (s + i) + c);
    return { shown: t.slice(0, 5), next: t[5] as number, explanation: `Second differences are constant (${2 * a}): an² + bn + c with a=${a}, b=${b}, c=${c}.`, hints: ["Take differences twice."], family: "quadratic", tag: "polynomial" };
  }, 3],
  interleaved: [(r, d) => {
    const a0 = r.int(1, 5), ka = r.int(1, 3), b0 = r.int(2, 9), kb = r.int(2, 5 + d);
    const t: number[] = [];
    for (let i = 0; i < 4; i++) t.push(a0 + ka * i, b0 + kb * i);
    return { shown: t.slice(0, 7), next: t[7] as number, explanation: `Two interleaved progressions: odd positions step ${ka}, even positions step ${kb}.`, hints: ["Split into odd- and even-indexed terms."], family: "interleaved", tag: "interleaved" };
  }, 3],
  fibonacci_like: [(r, d) => {
    const t = [r.int(1, 4 + d), r.int(1, 6 + d)];
    while (t.length < 8) t.push((t[t.length - 1] as number) + (t[t.length - 2] as number));
    return { shown: t.slice(0, 7), next: t[7] as number, explanation: "Each term is the sum of the previous two.", hints: ["Relate each term to the two before it."], family: "fibonacci_like", tag: "recursive" };
  }, 3],
  alternating: [(r, d) => {
    const m = r.pick([2, 3]), a = r.int(1, 5 + d);
    const t = [r.int(1, 6)];
    for (let i = 0; i < 6; i++) t.push(i % 2 === 0 ? (t[t.length - 1] as number) * m : (t[t.length - 1] as number) + a);
    return { shown: t.slice(0, 6), next: t[6] as number, explanation: `Alternately multiply by ${m} and add ${a}.`, hints: ["The rule changes each step."], family: "alternating", tag: "alternating" };
  }, 4],
  recursive_affine: [(r) => {
    const m = r.pick([2, 3]), c = r.pick([-1, 1, 2, -2, 3]);
    const t = [r.int(1, 5)];
    while (t.length < 6) t.push(m * (t[t.length - 1] as number) + c);
    return { shown: t.slice(0, 5), next: t[5] as number, explanation: `next = ${m} × previous ${c >= 0 ? "+" : "−"} ${Math.abs(c)}.`, hints: ["Compare each term with a multiple of the previous one."], family: "recursive_affine", tag: "recursive" };
  }, 5],
  primes: [(r, d) => {
    const p = primes(30), s = r.int(0, 10 + d);
    if (r.bool()) {
      const t = p.slice(s, s + 6);
      return { shown: t.slice(0, 5), next: t[5] as number, explanation: "Consecutive primes.", hints: ["Check divisibility."], family: "primes", tag: "primes" };
    }
    const g = Array.from({ length: 7 }, (_, i) => (p[s + i + 1] as number) - (p[s + i] as number));
    return { shown: g.slice(0, 6), next: g[6] as number, explanation: `Gaps between consecutive primes starting at ${p[s]}.`, hints: ["Differences of a famous sequence."], family: "prime_gaps", tag: "primes" };
  }, 5],
  cubic: [(r) => {
    const a = r.int(1, 2), c = r.int(-4, 6), s = r.int(1, 3);
    const t = Array.from({ length: 7 }, (_, i) => a * (s + i) ** 3 + c);
    return { shown: t.slice(0, 6), next: t[6] as number, explanation: `${a}n³ ${c >= 0 ? "+" : "−"} ${Math.abs(c)} (third differences constant).`, hints: ["Take differences three times."], family: "cubic", tag: "polynomial" };
  }, 6],
  modular: [(r) => {
    const m = r.pick([7, 9, 11, 13]), k = r.int(2, m - 2), x0 = r.int(1, m - 1);
    const t = Array.from({ length: 8 }, (_, i) => (x0 + k * i) % m);
    return { shown: t.slice(0, 7), next: t[7] as number, explanation: `Add ${k} each step, modulo ${m}.`, hints: [`Values never exceed ${m - 1}.`], family: "modular", tag: "modular" };
  }, 7],
};

export const SEQUENCE_FAMILIES = Object.keys(FAMILIES);

export function generateSequence(r: Rng, d: number, family?: string): SeqCandidate {
  const eligible = Object.entries(FAMILIES).filter(([, [, min]]) => min <= d).map(([k]) => k);
  for (let i = 0; i < 40; i++) {
    const key = family && FAMILIES[family] ? family : r.pick(eligible);
    const c = (FAMILIES[key] as [Fam, number])[0](r, d);
    if (isUnambiguous(c.shown, c.next)) return c;
  }
  throw new Error("no unambiguous sequence found");
}
