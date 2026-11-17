/**
 * Offline mental-arithmetic generators (practice mode). The Python engine in
 * services/api is the reference implementation used for server-graded assessments;
 * these mirror its families. Every answer is an exact rational.
 */
import { Rng } from "@/lib/rng";
import { dec, Q, q } from "@/lib/rational";
import type { Question } from "./types";

type Gen = (r: Rng, d: number) => Omit<Question, "id" | "type" | "difficulty" | "seed" | "version"> & { type?: string };

const MAG: Record<number, [number, number]> = {
  1: [2, 9], 2: [2, 12], 3: [3, 20], 4: [6, 40], 5: [11, 99], 6: [12, 150], 7: [21, 250], 8: [101, 999], 9: [101, 1999], 10: [201, 4999],
};

const mag = (d: number) => MAG[d] ?? [2, 9];
const decRand = (r: Rng, lo: number, hi: number, dp: number) => q(r.int(lo * 10 ** dp, hi * 10 ** dp), 10 ** dp);

function base(prompt: string, answer: Q, tags: string[], hints: string[] = [], solution: string[] = []) {
  return { prompt, inputType: "numeric" as const, answer, answerDisplay: answer.toString(), tolerance: 0, tags, hints, solution };
}

const multiplication: Gen = (r, d) => {
  const [lo, hi] = mag(d);
  let a = r.int(lo, hi);
  let b = d <= 2 ? r.int(2, 12) : r.int(Math.max(2, lo >> 1), Math.max(12, Math.floor(hi / (d < 8 ? 3 : 8))));
  let hint = "Split one factor into tens and units and distribute.";
  if (d >= 4 && d <= 6 && r.bool(0.3)) {
    const m = r.pick([20, 30, 40, 50, 60, 70, 80, 90]), k = r.int(1, 5);
    a = m - k; b = m + k;
    hint = `Write as $(${m}-${k})(${m}+${k}) = ${m}^2 - ${k}^2$.`;
  }
  const ans = q(a * b);
  return base(`${a} \\times ${b} = ?`, ans, ["arithmetic", "multiplication"], [hint], [`${a} \\times ${b} = ${ans}`]);
};

const division: Gen = (r, d) => {
  const [lo, hi] = mag(d);
  const quo = r.int(lo, Math.max(lo + 1, hi >> 1));
  const b = r.int(2, d <= 3 ? 9 : d <= 6 ? 25 : 99);
  return base(`${quo * b} \\div ${b} = ?`, q(quo), ["arithmetic", "division"], ["Estimate magnitude first, then refine."], [`${b} \\times ${quo} = ${quo * b}`]);
};

const addSub: Gen = (r, d) => {
  const scale = 10 ** Math.min(1 + (d >> 1), 5);
  const a = r.int(scale / 10 + 1, scale), b = r.int(scale / 10 + 1, scale);
  return r.bool()
    ? base(`${a} + ${b} = ?`, q(a + b), ["arithmetic", "addition"])
    : base(`${a} - ${b} = ?`, q(a - b), ["arithmetic", "addition"]);
};

const decimalMult: Gen = (r, d) => {
  const dp = d <= 4 ? 1 : 2;
  let a = decRand(r, 1, d <= 3 ? 9 : d <= 7 ? 40 : 99, dp);
  let b = d <= 6 ? decRand(r, 1, 9, 1) : decRand(r, 1, 20, 2);
  if (a.n === 0n || b.n === 0n) { a = dec("1.5"); b = dec("1.2"); }
  return base(`${a} \\times ${b} = ?`, a.mul(b), ["arithmetic", "decimals"], ["Multiply as integers, then count decimal places."]);
};

const decimalDiv: Gen = (r, d) => {
  const b = q(r.pick([2, 3, 4, 5, 6, 8, 12, 15, 25]), d >= 3 ? r.pick([10, 100]) : 10);
  let quo = q(r.int(2, d <= 5 ? 20 : 120));
  if (d >= 7 && r.bool()) quo = quo.div(q(10));
  return base(`${quo.mul(b)} \\div ${b} = ?`, quo, ["arithmetic", "decimals", "division"], ["Scale both by the same power of 10 to clear the divisor's decimals."]);
};

const PCT_EASY = ["10", "20", "25", "50", "5", "15", "30", "40", "75"];
const PCT_HARD = ["12.5", "17.5", "37.5", "62.5", "2.5", "7.5", "22.5", "33", "66", "8", "12", "35", "45", "65", "85"];

const percentOf: Gen = (r, d) => {
  const p = dec(r.pick(d <= 4 ? PCT_EASY : PCT_HARD));
  const b = d >= 8 ? r.int(101, 999) * 2 : r.pick([40, 60, 80, 120, 160, 200, 240, 320, 360, 400, 480, 640, 720, 800, 960, 1200]);
  const ans = p.mul(q(b)).div(q(100));
  return base(`${p}\\% \\text{ of } ${b} = ?`, ans, ["percentages"], [`Decompose ${p}% into 10%, 5%, 1% pieces.`], [`${p}\\% \\times ${b} = ${ans}`]);
};

const percentChange: Gen = (r, d) => {
  const old = r.pick([20, 25, 40, 50, 80, 120, 125, 160, 200, 250, 400, 500, 800]);
  const pct = dec(r.pick(d <= 5 ? ["5", "10", "15", "20", "25", "30", "40", "50", "60", "75"] : ["2.5", "12.5", "17.5", "35", "62.5", "4", "8", "45"]));
  const up = r.bool();
  const factor = up ? q(1).add(pct.div(q(100))) : q(1).sub(pct.div(q(100)));
  const nw = q(old).mul(factor);
  if (r.bool()) {
    const ans = up ? pct : pct.neg();
    return base(`\\text{From } ${old} \\text{ to } ${nw}\\text{: \\% change} = ?`, ans, ["percentages", "percent_change"],
      ["$\\Delta\\% = \\frac{\\text{new} - \\text{old}}{\\text{old}} \\times 100$ (negative for a decrease)."]);
  }
  return base(`${old} \\text{ ${up ? "increased" : "decreased"} by } ${pct}\\% = ?`, nw, ["percentages", "percent_change"], [`Multiply by ${factor}.`]);
};

const squares: Gen = (r, d) => {
  const hi = [12, 15, 20, 25, 35, 50, 75, 99, 150, 250][d - 1] ?? 12;
  const a = r.int(4, hi);
  return base(`${a}^2 = ?`, q(a * a), ["arithmetic", "squares"], ["Use $(a\\pm b)^2 = a^2 \\pm 2ab + b^2$ around a round number."]);
};

const cubes: Gen = (r, d) => {
  const hi = [5, 6, 8, 10, 12, 13, 15, 18, 21, 25][d - 1] ?? 5;
  const a = r.int(2, hi);
  return base(`${a}^3 = ?`, q(a ** 3), ["arithmetic", "cubes"]);
};

const sqrt: Gen = (r, d) => {
  const hi = [12, 15, 20, 25, 32, 45, 60, 80, 99, 150][d - 1] ?? 12;
  const a = r.int(2, hi);
  if (d >= 7 && r.bool(0.4)) {
    const x = q(a, 10);
    return base(`\\sqrt{${x.mul(x)}} = ?`, x, ["arithmetic", "roots"], ["The root has half as many decimal places."]);
  }
  return base(`\\sqrt{${a * a}} = ?`, q(a), ["arithmetic", "roots"], ["The last digit of the square constrains the root's last digit."]);
};

const fracTex = (x: Q) => (x.d === 1n ? x.n.toString() : `\\frac{${x.n}}{${x.d}}`);

const fractionArith: Gen = (r, d) => {
  const hi = d <= 3 ? 6 : d <= 7 ? 12 : 20;
  const a = q(r.int(1, hi - 1), r.int(2, hi)), b = q(r.int(1, hi - 1), r.int(2, hi));
  const ops = d < 6 ? ["+", "-", "\\times"] : ["+", "-", "\\times", "\\div"];
  const op = r.pick(ops);
  const ans = op === "+" ? a.add(b) : op === "-" ? a.sub(b) : op === "\\times" ? a.mul(b) : a.div(b);
  return { ...base(`${fracTex(a)} ${op} ${fracTex(b)} = ?`, ans, ["fractions"], ["Use a common denominator (lcm) for + and −."]),
    inputType: "fraction" as const, answerDisplay: ans.d === 1n ? ans.n.toString() : `${ans.n}/${ans.d}` };
};

const approximation: Gen = (r, d) => {
  const a = q(r.int(1000, 99999), r.pick([1, 10, 100]));
  const b = q(r.int(100, 9999), r.pick([1, 10, 100]));
  const mul = r.bool();
  const exact = mul ? a.mul(b) : a.div(b);
  const tol = d <= 5 ? 0.05 : 0.02;
  return { ...base(`${a} ${mul ? "\\times" : "\\div"} ${b} \\approx ? \\quad (\\pm ${tol * 100}\\%)`, exact, ["estimation", "arithmetic"],
    ["Round to 2 significant figures and correct for the rounding direction."]),
    answerDisplay: exact.toNumber().toFixed(2), tolerance: tol };
};

const missingOperand: Gen = (r, d) => {
  const kinds = d >= 3 ? ["mul", "mulL", "divN", "divD", "pct", "base", "add"] : ["mul", "add", "divN"];
  const kind = r.pick(kinds);
  const [lo, hi] = mag(Math.min(d, 8));
  let x: Q, prompt: string;
  if (kind === "mul" || kind === "mulL") {
    const a = r.int(lo, hi);
    x = d < 5 ? q(r.int(2, 30)) : decRand(r, 1, 9, 1);
    if (x.n === 0n) x = dec("2.1");
    const c = q(a).mul(x);
    prompt = kind === "mul" ? `${a} \\times ? = ${c}` : `? \\times ${a} = ${c}`;
  } else if (kind === "divN") {
    const b = r.int(2, d < 5 ? 12 : 40), quo = r.int(2, d < 5 ? 50 : 300);
    x = q(b * quo);
    prompt = `? \\div ${b} = ${quo}`;
  } else if (kind === "divD") {
    const quo = r.int(2, 40);
    x = q(r.int(2, 25));
    prompt = `${x.mul(q(quo))} \\div ? = ${quo}`;
  } else if (kind === "pct") {
    const b = r.pick([80, 120, 160, 240, 400, 480, 600, 800]);
    x = dec(r.pick(["5", "12.5", "15", "17.5", "20", "35", "37.5", "45", "62.5"]));
    prompt = `?\\% \\text{ of } ${b} = ${x.mul(q(b)).div(q(100))}`;
  } else if (kind === "base") {
    const p = q(r.pick([10, 20, 25, 40, 50, 75, 125, 150]));
    x = q(r.pick([40, 64, 80, 120, 160, 200, 320, 480]));
    prompt = `${p}\\% \\text{ of } ? = ${p.mul(x).div(q(100))}`;
  } else {
    const a = r.int(lo, hi * 3);
    x = q(r.int(lo, hi * 3));
    prompt = `${a} + ? = ${q(a).add(x)}`;
  }
  return base(prompt, x, ["arithmetic", "missing_operand"], ["Apply the inverse operation to isolate the unknown."]);
};

const OPS: Record<string, (a: Q, b: Q) => Q> = { "+": (a, b) => a.add(b), "−": (a, b) => a.sub(b), "×": (a, b) => a.mul(b), "÷": (a, b) => a.div(b) };

const missingOperator: Gen = (r, d) => {
  for (let i = 0; i < 50; i++) {
    let a = q(r.int(2, 12 * d));
    const b = q(r.int(2, 12 + d));
    const op = r.pick(Object.keys(OPS));
    if (op === "÷") a = b.mul(q(r.int(2, 12 + d)));
    const c = (OPS[op] as (a: Q, b: Q) => Q)(a, b);
    const matching = Object.values(OPS).filter((f) => f(a, b).eq(c)).length;
    if (matching === 1) {
      return { prompt: `${a} \\;\\square\\; ${b} = ${c}`, inputType: "choice" as const, choices: ["+", "−", "×", "÷"],
        answer: op, answerDisplay: op, tolerance: 0, tags: ["arithmetic", "missing_operator"], hints: [], solution: [`${a} ${op} ${b} = ${c}`] };
    }
  }
  throw new Error("could not build unambiguous operator question");
};

const multiStep: Gen = (r, d) => {
  const a = r.int(2, 9 + d * 2), b = r.int(2, 9 + d), c = r.int(2, 30 + d * 5), e = r.int(2, 9);
  const forms: [string, Q][] = [
    [`${a} \\times ${b} + ${c}`, q(a * b + c)],
    [`${a} \\times ${b} - ${c}`, q(a * b - c)],
    [`(${a}+${b}) \\times ${e} - ${c}`, q((a + b) * e - c)],
    [`${a} \\times ${b} \\times ${e}`, q(a * b * e)],
  ];
  const [p, ans] = r.pick(forms);
  return base(`${p} = ?`, ans, ["arithmetic", "multi_step"], ["Respect order of operations."]);
};

export const ARITHMETIC: Record<string, { title: string; gen: Gen; description: string }> = {
  multiplication: { title: "Multiplication", gen: multiplication, description: "Two-factor products, near-square tricks at mid levels." },
  division: { title: "Division", gen: division, description: "Exact integer quotients with growing divisors." },
  add_sub: { title: "Addition & Subtraction", gen: addSub, description: "Multi-digit sums and differences." },
  decimal_mult: { title: "Decimal Multiplication", gen: decimalMult, description: "Place-value control with 1–2 dp operands." },
  decimal_div: { title: "Decimal Division", gen: decimalDiv, description: "e.g. 3.6 ÷ 0.12 — scale to clear decimals." },
  percent_of: { title: "Percentages", gen: percentOf, description: "e.g. 17.5% of 480." },
  percent_change: { title: "Percentage Change", gen: percentChange, description: "Increases, decreases and % change." },
  squares: { title: "Squares", gen: squares, description: "Squares up to 250²." },
  cubes: { title: "Cubes", gen: cubes, description: "Cubes up to 25³." },
  sqrt: { title: "Square Roots", gen: sqrt, description: "Perfect-square roots incl. decimals." },
  fraction_arith: { title: "Fraction Arithmetic", gen: fractionArith, description: "+ − × ÷ on fractions, answer as a/b." },
  approximation: { title: "Estimation", gen: approximation, description: "Fast approximate products/quotients within tolerance." },
  missing_operand: { title: "Missing Operand", gen: missingOperand, description: "e.g. 66 × ? = 138.6." },
  missing_operator: { title: "Missing Operator", gen: missingOperator, description: "Choose the unique operator that fits." },
  multi_step: { title: "Multi-step", gen: multiStep, description: "Order-of-operations chains." },
};

export const MIXED_POOL = ["multiplication", "division", "add_sub", "decimal_mult", "decimal_div", "percent_of", "missing_operand", "squares"];
