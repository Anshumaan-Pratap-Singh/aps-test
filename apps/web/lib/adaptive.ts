/**
 * Rule-based adaptive difficulty (mirror of services/api/app/engines/adaptive.py).
 * Requires a full window of attempts at the current level before changing.
 */
import { median } from "./stats";

export const WINDOW = 20;

export const targetRtMs = (d: number) => 2500 + 900 * (d - 1);

export function nextDifficulty(current: number, recent: { correct: boolean; responseMs: number }[]): { level: number; reason: string } {
  if (recent.length < WINDOW) return { level: current, reason: `Need ${WINDOW - recent.length} more attempts at level ${current} before adapting.` };
  const w = recent.slice(-WINDOW);
  const acc = w.filter((a) => a.correct).length / WINDOW;
  const med = median(w.filter((a) => a.correct).map((a) => a.responseMs)) ?? Infinity;
  const tgt = targetRtMs(current);
  if (acc >= 0.9 && med <= tgt) return { level: Math.min(10, current + 1), reason: `Accuracy ${(acc * 100).toFixed(0)}% with median ${Math.round(med)}ms ≤ ${tgt}ms target: level up.` };
  if (acc >= 0.9) return { level: current, reason: `Accurate (${(acc * 100).toFixed(0)}%) but median ${Math.round(med)}ms > ${tgt}ms: hold level and push speed.` };
  if (acc < 0.6) return { level: Math.max(1, current - 1), reason: `Accuracy ${(acc * 100).toFixed(0)}% below 60%: step down temporarily.` };
  return { level: current, reason: `Accuracy ${(acc * 100).toFixed(0)}%: consolidate at level ${current}.` };
}

export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Single-digit facts, one step, generous time.",
  2: "Times tables to 12, simple percentages.",
  3: "Two-digit by one-digit, common fractions.",
  4: "Two-digit by two-digit, 1-dp decimals.",
  5: "Mixed decimals, harder percentages, missing operands.",
  6: "Three-digit operands, 2-dp decimals, multi-step.",
  7: "Larger magnitudes, decimal roots, tighter estimates.",
  8: "Three-digit by two-digit, non-round percentages.",
  9: "Four-digit operands, compound reasoning.",
  10: "Assessment-grade: large operands, minimal time.",
};
