/**
 * Local analytics: skill mastery, spaced-repetition due dates, readiness.
 * Every number here is derived from stored attempts/games; definitions are
 * shown verbatim on the Progress page.
 */
import type { LocalGame, LocalSession, LessonProgress } from "./db";
import { median } from "./stats";

export interface SkillState {
  tag: string;
  attempts: number;
  correct: number;
  ewma: number; // exponentially weighted accuracy by session, alpha = 0.3
  mastery: number; // ewma * n/(n+20) — discounted for little evidence
  lastAt: number;
  dueAt: number; // spaced-repetition due time (SM-2 style)
  intervalDays: number;
  medianMs: number | null;
}

const DAY = 86_400_000;
const ALPHA = 0.3;

/** Normalised [0,1] score from a game, used as a skill observation. */
export function gameObservation(g: LocalGame): { tags: string[]; value: number } | null {
  if (g.score == null || !g.endedAt) return null;
  const map: Record<string, string[]> = {
    market_making: ["market_making", "inventory_management"], etf_arbitrage: ["etf"], event_contracts: ["bayes", "market_making"],
    betting_board: ["expected_value"], fermi: ["estimation"], task_switch: ["cognitive_flexibility"], response_conflict: ["inhibition"],
    pincode: ["working_memory"],
  };
  const tags = map[g.gameType];
  if (!tags) return null;
  return { tags, value: Math.max(0, Math.min(1, g.score / 100)) };
}

export function skillStates(sessions: LocalSession[], games: LocalGame[]): SkillState[] {
  const events: { at: number; tag: string; c: number; n: number; rts: number[] }[] = [];
  for (const s of sessions) {
    const per = new Map<string, { c: number; n: number; rts: number[] }>();
    for (const a of s.attempts) {
      if (a.correct === null) continue;
      for (const t of a.tags) {
        const e = per.get(t) ?? { c: 0, n: 0, rts: [] };
        e.n++; if (a.correct) e.c++; e.rts.push(a.responseMs);
        per.set(t, e);
      }
    }
    for (const [tag, e] of per) events.push({ at: s.startedAt, tag, ...e });
  }
  for (const g of games) {
    const o = gameObservation(g);
    if (o) for (const tag of o.tags) events.push({ at: g.startedAt, tag, c: o.value * 10, n: 10, rts: [] });
  }
  events.sort((a, b) => a.at - b.at);
  const states = new Map<string, SkillState & { reps: number; ease: number; rtsAll: number[] }>();
  for (const e of events) {
    const acc = e.c / e.n;
    const s = states.get(e.tag) ?? { tag: e.tag, attempts: 0, correct: 0, ewma: acc, mastery: 0, lastAt: 0, dueAt: 0, intervalDays: 0, medianMs: null, reps: 0, ease: 2.5, rtsAll: [] };
    s.ewma = s.attempts === 0 ? acc : (1 - ALPHA) * s.ewma + ALPHA * acc;
    s.attempts += e.n;
    s.correct += e.c;
    s.lastAt = e.at;
    s.rtsAll.push(...e.rts);
    // SM-2 style schedule
    const qv = Math.round(5 * acc);
    s.ease = Math.max(1.3, s.ease + 0.1 - (5 - qv) * (0.08 + (5 - qv) * 0.02));
    if (qv < 3) { s.reps = 0; s.intervalDays = 0.5; } else { s.reps++; s.intervalDays = s.reps === 1 ? 1 : s.reps === 2 ? 3 : s.intervalDays * s.ease; }
    s.dueAt = e.at + s.intervalDays * DAY;
    states.set(e.tag, s);
  }
  return [...states.values()].map((s) => ({
    tag: s.tag, attempts: s.attempts, correct: s.correct, ewma: s.ewma, mastery: s.ewma * (s.attempts / (s.attempts + 20)),
    lastAt: s.lastAt, dueAt: s.dueAt, intervalDays: s.intervalDays, medianMs: median(s.rtsAll),
  })).sort((a, b) => a.tag.localeCompare(b.tag));
}

export interface ReadinessComponent { skill: string; weight: number; label: string; }

export const READINESS: Record<"trader" | "researcher" | "developer", ReadinessComponent[]> = {
  trader: [
    { skill: "arithmetic", weight: 0.2, label: "Mental arithmetic" },
    { skill: "percentages", weight: 0.1, label: "Percentages" },
    { skill: "sequences", weight: 0.1, label: "Sequences" },
    { skill: "probability", weight: 0.15, label: "Probability" },
    { skill: "expected_value", weight: 0.1, label: "Expected value" },
    { skill: "market_making", weight: 0.15, label: "Market making" },
    { skill: "estimation", weight: 0.05, label: "Estimation" },
    { skill: "bayes", weight: 0.05, label: "Bayesian updating" },
    { skill: "cognitive_flexibility", weight: 0.05, label: "Task switching" },
    { skill: "working_memory", weight: 0.05, label: "Working memory" },
  ],
  researcher: [
    { skill: "probability", weight: 0.25, label: "Probability" },
    { skill: "expected_value", weight: 0.1, label: "Expectation" },
    { skill: "bayes", weight: 0.1, label: "Bayesian inference" },
    { skill: "stochastic_processes", weight: 0.15, label: "Stochastic processes" },
    { skill: "research_methodology", weight: 0.2, label: "Research methodology" },
    { skill: "regression", weight: 0.1, label: "Regression" },
    { skill: "sequences", weight: 0.05, label: "Pattern recognition" },
    { skill: "combinatorics", weight: 0.05, label: "Combinatorics" },
  ],
  developer: [
    { skill: "algorithms", weight: 0.3, label: "Algorithms & data structures" },
    { skill: "cpp", weight: 0.15, label: "C++" },
    { skill: "systems", weight: 0.15, label: "Systems" },
    { skill: "concurrency", weight: 0.15, label: "Concurrency" },
    { skill: "trading_systems", weight: 0.1, label: "Trading systems" },
    { skill: "arithmetic", weight: 0.05, label: "Numeracy" },
    { skill: "probability", weight: 0.1, label: "Probability" },
  ],
};

export const MIN_EVIDENCE = 20;

export function lessonObservations(lessons: LessonProgress[], skillsByLesson: Record<string, string[]>): { tag: string; c: number; n: number }[] {
  const out: { tag: string; c: number; n: number }[] = [];
  for (const l of lessons) for (const tag of skillsByLesson[l.id] ?? []) if (l.checksTotal) out.push({ tag, c: l.checksCorrect, n: l.checksTotal });
  return out;
}

/**
 * readiness = Σ w_i·mastery_i / Σ w_i over components with ≥ MIN_EVIDENCE observations.
 * coverage  = Σ w_i (evidenced) — the share of the role profile actually measured.
 */
export function readiness(role: keyof typeof READINESS, skills: SkillState[]) {
  const comps = READINESS[role].map((c) => {
    const s = skills.find((x) => x.tag === c.skill);
    return { ...c, mastery: s?.mastery ?? null, evidence: s?.attempts ?? 0, measured: (s?.attempts ?? 0) >= MIN_EVIDENCE };
  });
  const measured = comps.filter((c) => c.measured);
  const coverage = measured.reduce((a, c) => a + c.weight, 0);
  const score = coverage > 0 ? measured.reduce((a, c) => a + c.weight * (c.mastery as number), 0) / coverage : null;
  return { score, coverage, components: comps };
}

export function streakDays(timestamps: number[], now = Date.now()): number {
  const days = new Set(timestamps.map((t) => new Date(t).toDateString()));
  let streak = 0;
  const d = new Date(now);
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // today not yet trained: streak through yesterday
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
