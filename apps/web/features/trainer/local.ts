import { checkAnswer, generateQuestion, type Question, type TrainerOptions } from "./generators";
import type { DisplayQuestion } from "./engine";
import type { ServerQuestion } from "@/lib/api";
import { parseNumber } from "@/lib/rational";

export const SEED_STRIDE = 100003;

export function toDisplay(q: Question): DisplayQuestion {
  return {
    id: q.id, type: q.type, seed: q.seed, version: q.version, prompt: q.prompt, inputType: q.inputType, choices: q.choices,
    tags: q.tags, hints: q.hints, solution: q.solution, answerDisplay: q.answerDisplay, grade: (input) => checkAnswer(q, input),
  };
}

export function localSource(type: string, seed: number, difficulty: number, opts: TrainerOptions = {}) {
  const cache = new Map<number, DisplayQuestion>();
  return (i: number) => {
    let d = cache.get(i);
    if (!d) {
      d = toDisplay(generateQuestion(type, seed * SEED_STRIDE + i, difficulty, opts));
      cache.set(i, d);
      // pre-generate the next question so Enter never waits on generation
      queueMicrotask(() => { if (!cache.has(i + 1)) cache.set(i + 1, toDisplay(generateQuestion(type, seed * SEED_STRIDE + i + 1, difficulty, opts))); });
    }
    return d;
  };
}

/** Questions from the server. If answers are present (practice batch) grade locally; else defer (assessment). */
export function serverToDisplay(q: ServerQuestion): DisplayQuestion {
  const answer = q.answer_display;
  const tol = q.rel_tolerance ? Number(q.rel_tolerance) : 0;
  return {
    id: q.question_id, type: q.question_type, seed: q.seed, version: q.generator_version, prompt: q.prompt_latex,
    inputType: q.input_type === "choice" ? "choice" : q.input_type === "fraction" ? "fraction" : "numeric",
    choices: q.choices, tags: q.skill_tags, hints: q.hint_steps, solution: q.solution_steps, answerDisplay: answer,
    grade: (input) => {
      if (answer === undefined) return null;
      if (q.input_type === "choice") return input.trim().toLowerCase() === answer.toLowerCase();
      const v = parseNumber(input), a = parseNumber(answer);
      if (!v || !a) return false;
      if (!tol) return v.eq(a);
      return Math.abs(v.toNumber() - a.toNumber()) <= Math.abs(a.toNumber()) * tol + 1e-12;
    },
  };
}
