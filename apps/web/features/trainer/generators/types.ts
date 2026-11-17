import type { Q } from "@/lib/rational";
import { parseNumber } from "@/lib/rational";

export type InputType = "numeric" | "fraction" | "choice";

export interface Question {
  id: string;
  type: string;
  difficulty: number;
  seed: number;
  prompt: string; // LaTeX
  inputType: InputType;
  choices?: string[];
  answer: Q | string;
  answerDisplay: string;
  /** Relative tolerance for estimation questions; 0 = exact. */
  tolerance: number;
  tags: string[];
  hints: string[];
  solution: string[];
  version: string;
}

export const GENERATOR_VERSION = "web-1.0";

export function checkAnswer(q: Pick<Question, "answer" | "tolerance">, input: string): boolean {
  if (typeof q.answer === "string") return input.trim().toLowerCase() === q.answer.toLowerCase();
  const v = parseNumber(input);
  if (!v) return false;
  if (!q.tolerance) return v.eq(q.answer);
  const a = q.answer.toNumber();
  return Math.abs(v.toNumber() - a) <= Math.abs(a) * q.tolerance + 1e-12;
}
