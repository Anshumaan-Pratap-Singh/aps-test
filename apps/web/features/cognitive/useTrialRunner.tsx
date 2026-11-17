"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Side, TrialResult } from "./design";

/**
 * Presents a sequence of timed trials. Stimulus onset is taken from the first
 * animation frame after the stimulus is committed (≈ paint), and RT uses the
 * input event's high-resolution timeStamp, so both share the performance.now clock.
 */
export function useTrialRunner<T extends { correct: Side; deadline: number; iti: number }>(trials: T[], onDone: (results: TrialResult[]) => void) {
  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState<"idle" | "iti" | "stimulus" | "done">("idle");
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const results = useRef<TrialResult[]>([]);
  const onset = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const answered = useRef(false);

  const clear = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; };

  const finishTrial = useCallback((res: TrialResult) => {
    if (answered.current) return;
    answered.current = true;
    clear();
    results.current.push(res);
    setLastCorrect(res.correct);
    setPhase("iti");
    const nextIdx = results.current.length;
    if (nextIdx >= trials.length) {
      setPhase("done");
      onDone(results.current);
      return;
    }
    timers.current.push(window.setTimeout(() => setIndex(nextIdx), (trials[nextIdx] as T).iti));
  }, [trials, onDone]);

  // On each new trial: show stimulus, timestamp onset at next frame, arm deadline.
  useEffect(() => {
    if (index < 0 || index >= trials.length) return;
    answered.current = false;
    onset.current = null;
    setPhase("stimulus");
    const raf = requestAnimationFrame(() => {
      onset.current = performance.now();
      const t = trials[index] as T;
      timers.current.push(window.setTimeout(() => finishTrial({ response: null, rt: null, correct: false }), t.deadline));
    });
    return () => cancelAnimationFrame(raf);
  }, [index, trials, finishTrial]);

  const respond = useCallback((side: Side, ts: number) => {
    if (phase !== "stimulus" || onset.current == null || index < 0) return;
    const t = trials[index] as T;
    finishTrial({ response: side, rt: Math.max(0, ts - onset.current), correct: side === t.correct });
  }, [phase, index, trials, finishTrial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "f" || e.key === "ArrowLeft") { e.preventDefault(); respond("L", e.timeStamp); }
      if (k === "j" || e.key === "ArrowRight") { e.preventDefault(); respond("R", e.timeStamp); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [respond]);

  useEffect(() => () => clear(), []);

  const start = useCallback(() => { results.current = []; setLastCorrect(null); setIndex(0); }, []);

  return { index, phase, start, respond, lastCorrect, results };
}

export function ResponsePads({ onRespond, left, right }: { onRespond: (s: Side, ts: number) => void; left: string; right: string }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      {(["L", "R"] as Side[]).map((s) => (
        <button key={s} type="button" data-testid={`pad-${s}`}
          onPointerDown={(e) => { e.preventDefault(); onRespond(s, e.timeStamp); }}
          className="rounded-lg border border-border bg-bg py-5 text-sm hover:border-cyan active:bg-elevated select-none touch-manipulation">
          <span className="block font-mono text-lg">{s === "L" ? "F / ←" : "J / →"}</span>
          <span className="text-muted">{s === "L" ? left : right}</span>
        </button>
      ))}
    </div>
  );
}
