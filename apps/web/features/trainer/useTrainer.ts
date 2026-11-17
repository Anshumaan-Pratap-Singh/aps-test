"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db, type LocalSession } from "@/lib/db";
import { measureNextPaint, record } from "@/lib/perf";
import { uid } from "@/lib/rng";
import type { SessionStats } from "@/lib/stats";
import { enqueueSession } from "@/lib/sync";
import { TrainingEngine, type DisplayQuestion, type EngineAttempt, type Phase } from "./engine";

export interface TrainerSessionMeta {
  trainer: string;
  category: LocalSession["category"];
  mode: LocalSession["mode"];
  configKey: string;
  difficulty: number;
  seed: number;
  /** Pre-existing client session id (server-issued for assessments). */
  sessionId?: string;
}

export interface UseTrainerArgs {
  meta: TrainerSessionMeta;
  questionAt: (i: number) => DisplayQuestion;
  questionLimit?: number;
  durationMs?: number;
  onFinish?: (s: LocalSession) => void;
}

export interface Feedback {
  key: number;
  correct: boolean | null;
  prompt: string;
  input: string;
  expected?: string;
  solution: string[];
}

/**
 * React binding for TrainingEngine. Mutable operational data lives in refs (engine,
 * session record); only what the UI renders is React state.
 */
export function useTrainer({ meta, questionAt, questionLimit, durationMs, onFinish }: UseTrainerArgs) {
  const engineRef = useRef<TrainingEngine | null>(null);
  const sessionRef = useRef<LocalSession | null>(null);
  const persistTimer = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [question, setQuestion] = useState<DisplayQuestion | null>(null);
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [final, setFinal] = useState<LocalSession | null>(null);

  const toLocalAttempt = (a: EngineAttempt) => ({
    eventId: uid(), questionId: a.question.id, questionType: a.question.type, questionVersion: a.question.version, seed: a.question.seed,
    prompt: a.question.prompt, answer: a.input, expected: a.question.answerDisplay, correct: a.correct, responseMs: a.responseMs,
    index: a.index, tags: a.question.tags, at: Date.now(),
  });

  const schedulePersist = useCallback(() => {
    if (persistTimer.current != null) return;
    // Off the hot path: coalesce writes and run after the frame.
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      const s = sessionRef.current, e = engineRef.current;
      if (s && e) { s.durationMs = e.elapsed(); void db.saveSession(s); }
    }, 250);
  }, []);

  const finalize = useCallback(() => {
    const e = engineRef.current, s = sessionRef.current;
    if (!e || !s || s.status === "completed") return;
    e.finish();
    s.status = "completed";
    s.endedAt = Date.now();
    s.durationMs = e.elapsed();
    setPhase("finished");
    setStats(e.stats());
    setFinal({ ...s });
    void db.saveSession(s).then(() => enqueueSession(s));
    onFinish?.(s);
  }, [onFinish]);

  const start = useCallback(() => {
    const e = new TrainingEngine({ questionAt, questionLimit, durationMs });
    engineRef.current = e;
    sessionRef.current = {
      id: meta.sessionId ?? uid(), trainer: meta.trainer, category: meta.category, mode: meta.mode, configKey: meta.configKey,
      difficulty: meta.difficulty, seed: meta.seed, startedAt: Date.now(), endedAt: null, durationMs: 0, attempts: [],
      status: "active", serverValidated: false, synced: false,
    };
    e.start();
    setQuestion(e.current);
    setIndex(0);
    setStats(e.stats());
    setFeedback(null);
    setFinal(null);
    setPhase("running");
    void db.saveSession(sessionRef.current);
  }, [meta, questionAt, questionLimit, durationMs]);

  /** Hot path. Synchronous; no awaits; no network. */
  const submit = useCallback((input: string, inputTs = performance.now()) => {
    const e = engineRef.current, s = sessionRef.current;
    if (!e || !s) return false;
    const t0 = performance.now();
    const a = e.submit(input);
    if (!a) {
      if (e.phase === "finished") finalize();
      return false;
    }
    s.attempts.push(toLocalAttempt(a));
    const st = e.stats();
    record("processing", performance.now() - t0);
    setFeedback({ key: a.index, correct: a.correct, prompt: a.question.prompt, input: a.input, expected: a.question.answerDisplay, solution: a.question.solution });
    setStats(st);
    if (e.phase === "finished") {
      finalize();
    } else {
      setQuestion(e.current);
      setIndex(e.index);
      measureNextPaint(inputTs);
      schedulePersist();
    }
    return true;
  }, [finalize, schedulePersist]);

  const onExpire = useCallback(() => {
    const e = engineRef.current;
    if (e && e.checkDeadline()) finalize();
  }, [finalize]);

  const quit = useCallback(() => finalize(), [finalize]);

  // Persist active session if the tab is hidden/closed (recovery).
  useEffect(() => {
    const save = () => { const s = sessionRef.current, e = engineRef.current; if (s && e && s.status === "active") { s.durationMs = e.elapsed(); void db.saveSession(s); } };
    document.addEventListener("visibilitychange", save);
    window.addEventListener("pagehide", save);
    return () => { document.removeEventListener("visibilitychange", save); window.removeEventListener("pagehide", save); };
  }, []);

  return { phase, question, index, stats, feedback, final, start, submit, quit, onExpire, engineRef };
}
