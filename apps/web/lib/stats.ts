/** Statistics computed purely from the attempt history (single source of truth). */
export interface AttemptLike {
  correct: boolean;
  responseMs: number;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs) as number;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Nearest-rank percentile (p in (0,1]). */
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(p * s.length) - 1)] as number;
}

export interface SessionStats {
  attempts: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  meanMs: number | null;
  medianMs: number | null;
  p90Ms: number | null;
  fastestCorrectMs: number | null;
  streak: number;
  bestStreak: number;
  netScore: number;
  qpm: number;
}

export function computeStats(attempts: AttemptLike[], elapsedMs: number, penalty = 1): SessionStats {
  let streak = 0, best = 0, correct = 0;
  for (const a of attempts) {
    if (a.correct) { correct++; streak++; best = Math.max(best, streak); } else streak = 0;
  }
  const rts = attempts.map((a) => a.responseMs);
  const correctRts = attempts.filter((a) => a.correct).map((a) => a.responseMs);
  const n = attempts.length;
  return {
    attempts: n, correct, incorrect: n - correct, accuracy: n ? correct / n : 0,
    meanMs: mean(rts), medianMs: median(rts), p90Ms: percentile(rts, 0.9),
    fastestCorrectMs: correctRts.length ? Math.min(...correctRts) : null,
    streak, bestStreak: best, netScore: correct - penalty * (n - correct),
    qpm: elapsedMs > 0 ? n / (elapsedMs / 60000) : 0,
  };
}

export function fmtMs(ms: number | null | undefined, digits = 0): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return ms >= 10000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(digits)}ms`;
}

export function fmtPct(x: number | null | undefined, digits = 0): string {
  return x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(digits)}%`;
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
