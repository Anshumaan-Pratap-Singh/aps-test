import { Rng } from "@/lib/rng";
import { q } from "@/lib/rational";
import { ARITHMETIC, MIXED_POOL } from "./arithmetic";
import { generateFraction, type FractionKind } from "./fractions";
import { generateSequence } from "./sequences";
import { checkAnswer, GENERATOR_VERSION, type Question } from "./types";

export type TrainerKind = keyof typeof ARITHMETIC | "mixed" | "sequence" | "fraction_conversion";

export interface TrainerOptions {
  family?: string;
  fractionKinds?: FractionKind[];
}

function idFor(type: string, d: number, seed: number) {
  return `${GENERATOR_VERSION}:${type}:${d}:${seed}`;
}

/** Deterministic: same (type, seed, difficulty, options) => same question. */
export function generateQuestion(type: string, seed: number, difficulty: number, opts: TrainerOptions = {}): Question {
  const d = Math.max(1, Math.min(10, Math.round(difficulty)));
  for (let attempt = 0; attempt < 25; attempt++) {
    const r = new Rng(`${type}:${seed}:${d}:${attempt}`);
    let qn: Question;
    if (type === "sequence") {
      const s = generateSequence(r, d, opts.family);
      qn = {
        id: idFor(type, d, seed), type, difficulty: d, seed, version: GENERATOR_VERSION,
        prompt: s.shown.join(",\\ ") + ",\\ ?", inputType: "numeric", answer: q(s.next), answerDisplay: String(s.next), tolerance: 0,
        tags: ["sequences", s.tag], hints: [...s.hints, s.explanation.split(":")[0] as string], solution: [s.explanation, `Next term: ${s.next}`],
      };
    } else if (type === "fraction_conversion") {
      const f = generateFraction(r, d, opts.fractionKinds);
      qn = { id: idFor(type, d, seed), type, difficulty: d, seed, version: GENERATOR_VERSION, prompt: f.prompt, inputType: f.inputType,
        choices: f.choices, answer: f.answer, answerDisplay: f.answerDisplay, tolerance: f.tolerance,
        tags: ["fractions", f.kind === "to_pct" ? "percentages" : "decimals"], hints: f.hints, solution: f.solution };
    } else {
      const key = type === "mixed" ? r.pick(MIXED_POOL) : type;
      const spec = ARITHMETIC[key];
      if (!spec) throw new Error(`unknown trainer ${type}`);
      const g = spec.gen(r, d);
      qn = { id: idFor(type, d, seed), type: key, difficulty: d, seed, version: GENERATOR_VERSION, ...g };
    }
    // Verification: the displayed answer must round-trip to the exact answer.
    if (checkAnswer(qn, qn.answerDisplay)) {
      if (qn.inputType === "numeric" && typeof qn.answer !== "string" && !qn.tolerance && !qn.answer.isTerminating()) continue;
      return qn;
    }
  }
  throw new Error(`generator ${type} failed verification for seed ${seed}`);
}

export { ARITHMETIC, checkAnswer };
export type { Question };
