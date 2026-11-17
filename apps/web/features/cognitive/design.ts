/**
 * Trial designs and metrics for the cognitive games. Pure functions — the UIs
 * only present trials and record (response, rt).
 *
 * Response mapping everywhere: LEFT = key F / left button, RIGHT = key J / right button.
 */
import { Rng } from "@/lib/rng";
import { median, stdev } from "@/lib/stats";

export type Side = "L" | "R";

export interface TrialResult { response: Side | null; rt: number | null; correct: boolean }

// ---------------------------------------------------------------- Task switch
export type TsRule = "parity" | "magnitude";
export interface TsTrial { kind: "task_switch"; n: number; rule: TsRule; switch: boolean; congruent: boolean; correct: Side; deadline: number; iti: number }

/** parity: odd → L, even → R. magnitude: < 5 → L, > 5 → R. 5 is never shown, so every trial has exactly one answer. */
export const tsAnswer = (n: number, rule: TsRule): Side => (rule === "parity" ? (n % 2 ? "L" : "R") : n < 5 ? "L" : "R");

export function taskSwitchTrials(seed: number, difficulty: number, count = 48): TsTrial[] {
  const r = new Rng(`ts:${seed}`);
  const switchRate = 0.33 + 0.02 * difficulty;
  const base = 2600 - 140 * difficulty;
  // Balance congruency exactly: half congruent, half incongruent, shuffled.
  const cong = r.shuffle(Array.from({ length: count }, (_, i) => i % 2 === 0));
  const trials: TsTrial[] = [];
  let rule: TsRule = r.bool() ? "parity" : "magnitude";
  for (let i = 0; i < count; i++) {
    const sw = i > 0 && r.next() < switchRate;
    if (sw) rule = rule === "parity" ? "magnitude" : "parity";
    const wantCong = cong[i] as boolean;
    const pool = [1, 2, 3, 4, 6, 7, 8, 9].filter((n) => (tsAnswer(n, "parity") === tsAnswer(n, "magnitude")) === wantCong);
    const n = r.pick(pool);
    // deadline tightens by 30% across the session (time pressure ramp)
    const deadline = Math.round(base * (1 - 0.3 * (i / Math.max(1, count - 1))));
    trials.push({ kind: "task_switch", n, rule, switch: sw, congruent: wantCong, correct: tsAnswer(n, rule), deadline, iti: 350 + r.int(0, 400) });
  }
  return trials;
}

// ------------------------------------------------------------ Response conflict
export interface RcTrial { kind: "flanker" | "simon"; congruent: boolean; target: Side; position?: Side; display: string; correct: Side; deadline: number; iti: number }

export function conflictTrials(seed: number, difficulty: number, perCell = 10): RcTrial[] {
  const r = new Rng(`rc:${seed}`);
  const deadline = 2000 - 100 * difficulty;
  const cells: RcTrial[] = [];
  for (const kind of ["flanker", "simon"] as const) for (const congruent of [true, false]) for (const target of ["L", "R"] as Side[]) {
    for (let k = 0; k < perCell / 2; k++) {
      if (kind === "flanker") {
        const c = target === "L" ? "←" : "→", f = congruent ? c : target === "L" ? "→" : "←";
        cells.push({ kind, congruent, target, display: `${f}${f}${c}${f}${f}`, correct: target, deadline, iti: 0 });
      } else {
        // colour determines the response: cyan → LEFT, blue → RIGHT; position is irrelevant
        const position: Side = congruent ? target : target === "L" ? "R" : "L";
        cells.push({ kind, congruent, target, position, display: target === "L" ? "cyan" : "blue", correct: target, deadline, iti: 0 });
      }
    }
  }
  // Shuffle with a constraint: no more than 3 consecutive trials of the same (kind, congruency) cell.
  for (let attempt = 0; attempt < 200; attempt++) {
    const s = r.shuffle([...cells]);
    let ok = true, run = 1;
    for (let i = 1; i < s.length && ok; i++) {
      const same = s[i]!.kind === s[i - 1]!.kind && s[i]!.congruent === s[i - 1]!.congruent;
      run = same ? run + 1 : 1;
      if (run > 3) ok = false;
    }
    if (ok) return s.map((t) => ({ ...t, iti: 400 + r.int(0, 400) }));
  }
  return r.shuffle(cells).map((t) => ({ ...t, iti: 500 }));
}

// --------------------------------------------------------------------- Metrics
const correctRts = (rs: { res: TrialResult }[]) => rs.filter((x) => x.res.correct && x.res.rt != null).map((x) => x.res.rt as number);
const acc = (rs: { res: TrialResult }[]) => (rs.length ? rs.filter((x) => x.res.correct).length / rs.length : null);

export function taskSwitchMetrics(trials: TsTrial[], results: TrialResult[]) {
  const rows = trials.slice(0, results.length).map((t, i) => ({ t, res: results[i] as TrialResult }));
  const sw = rows.filter((x) => x.t.switch), rep = rows.filter((x) => !x.t.switch && rows.indexOf(x) > 0);
  const allRt = correctRts(rows);
  const third = Math.floor(rows.length / 3);
  const late = rows.slice(rows.length - third);
  const ms = (x: number | null) => x;
  return {
    trials: rows.length, accuracy: acc(rows), medianRt: median(allRt), rtSd: stdev(allRt),
    switchCost: ms(median(correctRts(sw)) != null && median(correctRts(rep)) != null ? (median(correctRts(sw)) as number) - (median(correctRts(rep)) as number) : null),
    switchAccuracy: acc(sw), repeatAccuracy: acc(rep),
    congruentAccuracy: acc(rows.filter((x) => x.t.congruent)), incongruentAccuracy: acc(rows.filter((x) => !x.t.congruent)),
    pressureErrorRate: late.length ? late.filter((x) => !x.res.correct).length / late.length : null,
    omissions: rows.filter((x) => x.res.response === null).length,
  };
}

export function conflictMetrics(trials: RcTrial[], results: TrialResult[]) {
  const rows = trials.slice(0, results.length).map((t, i) => ({ t, res: results[i] as TrialResult }));
  const by = (kind: RcTrial["kind"] | null, congruent: boolean) => rows.filter((x) => (kind === null || x.t.kind === kind) && x.t.congruent === congruent);
  const effect = (kind: RcTrial["kind"] | null) => {
    const i = median(correctRts(by(kind, false))), c = median(correctRts(by(kind, true)));
    return i != null && c != null ? i - c : null;
  };
  return {
    trials: rows.length, congruentAccuracy: acc(by(null, true)), incongruentAccuracy: acc(by(null, false)),
    medianRt: median(correctRts(rows)), medianRtCongruent: median(correctRts(by(null, true))), medianRtIncongruent: median(correctRts(by(null, false))),
    congruencyEffect: effect(null), flankerEffect: effect("flanker"), simonEffect: effect("simon"),
    commissionErrors: rows.filter((x) => x.res.response !== null && !x.res.correct).length,
    omissionErrors: rows.filter((x) => x.res.response === null).length,
  };
}

/** 0–100 composite for skill tracking: accuracy-weighted speed (documented on the Progress page). */
export function cognitiveScore(accuracy: number | null, medianRt: number | null, refMs = 900) {
  if (accuracy == null || medianRt == null) return 0;
  return Math.max(0, Math.min(100, 100 * accuracy * Math.min(1, refMs / medianRt) ** 0.5));
}

// ---------------------------------------------------------------------- Pincode
export type PinTransform = "forward" | "backward" | "ascending" | "descending" | "evens" | "odds" | "positions" | "plus_one";

export const PIN_LABEL: Record<PinTransform, string> = {
  forward: "Repeat forwards", backward: "Repeat backwards", ascending: "Sort ascending", descending: "Sort descending",
  evens: "Even digits only (original order)", odds: "Odd digits only (original order)", positions: "Digits at the given positions", plus_one: "Add 1 to each digit (9 → 0)",
};

export function pinAnswer(digits: number[], t: PinTransform, positions: number[] = []): string {
  switch (t) {
    case "forward": return digits.join("");
    case "backward": return [...digits].reverse().join("");
    case "ascending": return [...digits].sort((a, b) => a - b).join("");
    case "descending": return [...digits].sort((a, b) => b - a).join("");
    case "evens": return digits.filter((d) => d % 2 === 0).join("");
    case "odds": return digits.filter((d) => d % 2 === 1).join("");
    case "positions": return positions.map((p) => digits[p - 1]).join("");
    case "plus_one": return digits.map((d) => (d + 1) % 10).join("");
  }
}

export function pinTrial(r: Rng, length: number, difficulty: number) {
  const pool: PinTransform[] = difficulty <= 2 ? ["forward", "backward"] : difficulty <= 5 ? ["forward", "backward", "ascending", "evens", "odds"] : ["backward", "ascending", "descending", "evens", "odds", "positions", "plus_one"];
  let t = r.pick(pool);
  const digits = Array.from({ length }, () => r.int(0, 9));
  if ((t === "evens" && !digits.some((d) => d % 2 === 0)) || (t === "odds" && !digits.some((d) => d % 2 === 1))) t = "backward";
  const positions = t === "positions" ? r.shuffle(Array.from({ length }, (_, i) => i + 1)).slice(0, 2).sort((a, b) => a - b) : [];
  return { digits, transform: t, positions, answer: pinAnswer(digits, t, positions), showTransformFirst: difficulty <= 4 };
}

export type PinError = "none" | "omission" | "intrusion" | "transposition" | "substitution";

export function classifyPinError(expected: string, given: string): PinError {
  if (expected === given) return "none";
  if (given.length < expected.length) return "omission";
  const exp = expected.split("").sort().join(""), giv = given.split("").sort().join("");
  if (exp === giv) return "transposition";
  if (given.split("").some((c) => !expected.includes(c))) return "intrusion";
  return "substitution";
}

/** 2-up / 1-down staircase on sequence length. */
export function nextLength(len: number, streak: number, correct: boolean): { len: number; streak: number } {
  if (!correct) return { len: Math.max(3, len - 1), streak: 0 };
  return streak + 1 >= 2 ? { len: Math.min(12, len + 1), streak: 0 } : { len, streak: streak + 1 };
}
