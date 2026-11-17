import { Rng } from "@/lib/rng";
import { q, Q } from "@/lib/rational";

const EASY = [2, 4, 5, 8, 10, 20, 25];
const MID = [3, 6, 8, 12, 16, 40, 50];
const HARD = [7, 9, 11, 13, 16, 32, 40, 80, 125];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

function randFraction(r: Rng, d: number): Q {
  const pool = d <= 3 ? EASY : d <= 6 ? [...EASY, ...MID] : [...MID, ...HARD];
  const den = r.pick(pool);
  let num = r.int(1, den - 1);
  while (gcd(num, den) !== 1) num = r.int(1, den - 1);
  return q(num, den);
}

export type FractionKind = "to_pct" | "to_dec" | "from_dec" | "simplify" | "compare";

export interface FractionQ {
  kind: FractionKind;
  prompt: string;
  inputType: "numeric" | "fraction" | "choice";
  choices?: string[];
  answer: Q | string;
  answerDisplay: string;
  tolerance: number;
  solution: string[];
  hints: string[];
}

const tex = (x: Q) => `\\frac{${x.n}}{${x.d}}`;

export function generateFraction(r: Rng, d: number, kinds?: FractionKind[]): FractionQ {
  const pool: FractionKind[] = kinds?.length ? kinds : d >= 3 ? ["to_pct", "to_dec", "from_dec", "simplify", "compare"] : ["to_pct", "to_dec"];
  const kind = r.pick(pool);
  const fr = randFraction(r, d);
  if (kind === "to_pct" || kind === "to_dec") {
    const target = kind === "to_pct" ? fr.mul(q(100)) : fr;
    const unit = kind === "to_pct" ? "\\%" : "";
    if (fr.isTerminating()) {
      return { kind, prompt: `${tex(fr)} = ?${unit}`, inputType: "numeric", answer: target, answerDisplay: target.toString(), tolerance: 0,
        solution: [`${tex(fr)} = ${target}${unit}`], hints: ["Scale the denominator to a power of 10."] };
    }
    // recurring: answer to 2 d.p.; accept within ±0.005 absolute
    const tol = 0.005 / Math.abs(target.toNumber());
    return { kind, prompt: `${tex(fr)} = ?${unit} \\quad (\\text{2 d.p.})`, inputType: "numeric", answer: target,
      answerDisplay: target.toNumber().toFixed(2), tolerance: tol, solution: [`${tex(fr)} = ${target.toNumber().toFixed(4)}\\ldots${unit}`],
      hints: [`Recall 1/${fr.d} and multiply by ${fr.n}.`] };
  }
  if (kind === "from_dec") {
    let f = d >= 5 ? q(r.pick([1, 3, 5, 7, 9, 11, 13, 15]), r.pick([8, 16, 40, 20])) : q(r.pick([1, 3]), r.pick([4, 8, 5]));
    if (f.cmp(q(1)) >= 0) f = f.sub(q(f.n / f.d));
    if (f.n === 0n) f = q(3, 8);
    return { kind, prompt: `${f.toString()} = \\frac{?}{${f.d}}`, inputType: "numeric", answer: q(f.n), answerDisplay: f.n.toString(), tolerance: 0,
      solution: [`${f.toString()} = ${tex(f)}`], hints: ["Multiply the decimal by the denominator."] };
  }
  if (kind === "simplify") {
    const k = r.int(2, 9);
    const big = `\\frac{${fr.n * BigInt(k)}}{${fr.d * BigInt(k)}}`;
    return { kind, prompt: `\\text{Simplify } ${big}`, inputType: "fraction", answer: fr, answerDisplay: `${fr.n}/${fr.d}`, tolerance: 0,
      solution: [`\\gcd = ${k}`, `${big} = ${tex(fr)}`], hints: ["Find the gcd of numerator and denominator."] };
  }
  let other = randFraction(r, d);
  while (other.eq(fr)) other = randFraction(r, d);
  const ans = fr.cmp(other) > 0 ? "A" : "B";
  return { kind, prompt: `\\text{Larger? } A = ${tex(fr)} \\quad B = ${tex(other)}`, inputType: "choice", choices: ["A", "B"], answer: ans, answerDisplay: ans,
    tolerance: 0, solution: [`${fr.n}\\times${other.d} = ${fr.n * other.d}\\text{ vs }${other.n}\\times${fr.d} = ${other.n * fr.d}`], hints: ["Cross-multiply."] };
}

/** Recognition flash-card set: fraction → percentage, the core table traders memorise. */
export const RECOGNITION_TABLE: [number, number][] = [
  [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [1, 6], [5, 6], [1, 7], [1, 8], [3, 8], [5, 8], [7, 8], [1, 9], [1, 11], [1, 12],
  [5, 12], [7, 12], [1, 16], [3, 16], [5, 16], [7, 16], [9, 16], [1, 20], [3, 40], [7, 40], [1, 25], [1, 32], [1, 40], [1, 50],
];
