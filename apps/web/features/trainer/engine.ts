/**
 * Training-session engine: a framework-agnostic state machine used by the React
 * hook. All high-frequency work (grading, timing, queueing) happens here,
 * synchronously and locally — never awaiting the network.
 *
 * Timing: elapsed = clock() - startTs. Nothing counts down via intervals, so the
 * session clock cannot drift regardless of frame scheduling.
 */
import { computeStats, type SessionStats } from "@/lib/stats";

export interface DisplayQuestion {
  id: string;
  type: string;
  seed: number;
  version: string;
  prompt: string;
  inputType: "numeric" | "fraction" | "choice";
  choices?: string[];
  tags: string[];
  hints: string[];
  solution: string[];
  answerDisplay?: string; // absent for server-graded assessments
  /** Returns correctness, or null when grading is deferred to the server. */
  grade: (input: string) => boolean | null;
}

export interface EngineConfig {
  questionAt: (index: number) => DisplayQuestion;
  questionLimit?: number;
  durationMs?: number;
  clock?: () => number;
}

export interface EngineAttempt {
  index: number;
  question: DisplayQuestion;
  input: string;
  correct: boolean | null;
  responseMs: number;
  at: number;
}

export type Phase = "ready" | "running" | "finished";

export class TrainingEngine {
  phase: Phase = "ready";
  index = 0;
  attempts: EngineAttempt[] = [];
  startTs = 0;
  endTs = 0;
  questionStartTs = 0;
  current: DisplayQuestion | null = null;
  private clock: () => number;
  private lastSubmitIndex = -1;

  constructor(private cfg: EngineConfig) {
    this.clock = cfg.clock ?? (() => performance.now());
  }

  start() {
    if (this.phase !== "ready") return;
    this.phase = "running";
    this.startTs = this.clock();
    this.index = 0;
    this.current = this.cfg.questionAt(0);
    this.questionStartTs = this.startTs;
  }

  elapsed(): number {
    if (this.phase === "ready") return 0;
    return (this.phase === "finished" ? this.endTs : this.clock()) - this.startTs;
  }

  remaining(): number | null {
    return this.cfg.durationMs == null ? null : Math.max(0, this.cfg.durationMs - this.elapsed());
  }

  /** Ends the session if the deadline passed. Returns true if it is (now) finished. */
  checkDeadline(): boolean {
    if (this.phase === "running" && this.cfg.durationMs != null && this.clock() - this.startTs >= this.cfg.durationMs) {
      this.finish(this.startTs + this.cfg.durationMs);
    }
    return this.phase === "finished";
  }

  /**
   * Grade and advance. Duplicate-safe: a second submit for the same question index
   * (e.g. key repeat, double Enter, double tap) is ignored.
   */
  submit(input: string, forIndex = this.index): EngineAttempt | null {
    if (this.phase !== "running" || !this.current) return null;
    if (forIndex !== this.index || this.lastSubmitIndex === this.index) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    const now = this.clock();
    if (this.checkDeadline()) return null; // answers after the deadline do not count
    this.lastSubmitIndex = this.index;
    const q = this.current;
    const attempt: EngineAttempt = { index: this.index, question: q, input: trimmed, correct: q.grade(trimmed), responseMs: now - this.questionStartTs, at: now };
    this.attempts.push(attempt);
    this.index += 1;
    if (this.cfg.questionLimit != null && this.index >= this.cfg.questionLimit) {
      this.finish(now);
    } else {
      this.current = this.cfg.questionAt(this.index);
      this.questionStartTs = now;
    }
    return attempt;
  }

  finish(at = this.clock()) {
    if (this.phase === "finished") return;
    this.phase = "finished";
    this.endTs = at;
  }

  stats(): SessionStats {
    return computeStats(
      this.attempts.map((a) => ({ correct: a.correct === true, responseMs: a.responseMs })),
      this.elapsed(),
    );
  }
}
