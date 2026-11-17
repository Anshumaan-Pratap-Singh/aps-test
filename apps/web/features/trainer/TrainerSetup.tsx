"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { LEVEL_DESCRIPTIONS, nextDifficulty } from "@/lib/adaptive";
import type { LocalSession } from "@/lib/db";
import { randomSeed } from "@/lib/rng";
import { usePrefs } from "@/stores/app";
import type { TrainerOptions } from "./generators";
import { localSource } from "./local";
import { TrainerConsole } from "./TrainerConsole";
import type { DisplayQuestion } from "./engine";
import { generateQuestion } from "./generators";
import { M } from "@/components/Math";
import { parseNumber } from "@/lib/rational";

export type ModeKey = "untimed" | "timed60" | "timed120" | "fixed20" | "fixed50" | "continuous" | "pb";

const MODES: { key: ModeKey; label: string; limit?: number; duration?: number; desc: string }[] = [
  { key: "untimed", label: "Untimed practice", limit: 20, desc: "20 questions, no clock pressure, full feedback." },
  { key: "timed60", label: "Sprint 60s", duration: 60_000, desc: "As many as possible in one minute." },
  { key: "timed120", label: "Sprint 120s", duration: 120_000, desc: "Two-minute speed run." },
  { key: "fixed20", label: "20 questions", limit: 20, desc: "Fixed count, timed for speed stats." },
  { key: "fixed50", label: "50 questions", limit: 50, desc: "Longer fixed set." },
  { key: "continuous", label: "Continuous", desc: "Runs until you end it." },
  { key: "pb", label: "Personal-best challenge", duration: 120_000, desc: "120s at your level; beat your best net score." },
];

export function TrainerSetup({ trainer, title, initialMode = "untimed", options, typeChoices, extraControls, allowHints, groupBy }: {
  trainer: string; title: string; initialMode?: ModeKey; options?: TrainerOptions; typeChoices?: { key: string; label: string }[];
  extraControls?: React.ReactNode; allowHints?: boolean; groupBy?: (a: LocalSession["attempts"][number]) => string;
}) {
  const { levels, setLevel } = usePrefs();
  const [type, setType] = useState(trainer);
  const level = levels[type] ?? 3;
  const [mode, setMode] = useState<ModeKey>(initialMode);
  const [running, setRunning] = useState<null | { seed: number; source: (i: number) => DisplayQuestion; limit?: number; duration?: number; key: string }>(null);
  const [adaptMsg, setAdaptMsg] = useState<string | null>(null);

  const m = MODES.find((x) => x.key === mode) ?? MODES[0]!;

  const launch = useCallback(() => {
    const seed = randomSeed();
    setAdaptMsg(null);
    setRunning({ seed, source: localSource(type, seed, level, options), limit: m.limit, duration: m.duration, key: `${seed}` });
  }, [type, level, options, m]);

  /** Error-correction mode: replay exactly the questions answered wrongly, graded against the stored exact answers. */
  const retry = useCallback((wrong: LocalSession["attempts"]) => {
    const qs: DisplayQuestion[] = wrong.map((w) => ({
      id: w.questionId, type: w.questionType, seed: w.seed, version: w.questionVersion, prompt: w.prompt, inputType: "numeric",
      tags: w.tags, hints: [], solution: [], answerDisplay: w.expected,
      grade: (input: string) => {
        const e = w.expected;
        if (e === undefined) return null;
        const a = parseNumber(e), v = parseNumber(input);
        return a && v ? a.eq(v) : input.trim().toLowerCase() === e.toLowerCase();
      },
    }));
    setRunning({ seed: randomSeed(), source: (i) => qs[i % qs.length]!, limit: qs.length, key: `retry-${Date.now()}` });
  }, []);

  const onFinish = useCallback((s: LocalSession) => {
    if (s.mode === "assessment") return;
    const rec = s.attempts.map((a) => ({ correct: !!a.correct, responseMs: a.responseMs }));
    const r = nextDifficulty(s.difficulty, rec);
    if (r.level !== s.difficulty) setLevel(type, r.level);
    setAdaptMsg(r.reason);
  }, [setLevel, type]);

  const meta = useMemo(() => running ? ({
    trainer: type, category: "mental_math" as LocalSession["category"],
    mode: (m.duration ? "timed" : "untimed") as LocalSession["mode"], configKey: mode, difficulty: level, seed: running.seed,
  }) : null, [running, type, m, mode, level]);

  if (running && meta) {
    return (
      <TrainerConsole key={running.key} meta={meta} questionAt={running.source} questionLimit={running.limit} durationMs={running.duration}
        showFeedback autoStart allowHints={allowHints && !m.duration} groupBy={groupBy} onFinish={onFinish} onRetryMistakes={retry} onExit={() => setRunning(null)}
        resultsExtra={() => adaptMsg ? <Notice>Adaptive difficulty: {adaptMsg}</Notice> : null} />
    );
  }

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {typeChoices && (
        <fieldset>
          <legend className="text-xs uppercase tracking-wider text-muted mb-2">Question type</legend>
          <div className="flex flex-wrap gap-2">
            {typeChoices.map((c) => (
              <button key={c.key} onClick={() => setType(c.key)} aria-pressed={type === c.key}
                className={`rounded-md border px-3 py-1.5 text-sm ${type === c.key ? "border-cyan text-cyan bg-elevated" : "border-border text-muted hover:text-text"}`}>{c.label}</button>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <label htmlFor="level" className="text-xs uppercase tracking-wider text-muted">Difficulty: <span className="font-mono text-cyan">{level}</span> / 10</label>
        <input id="level" type="range" min={1} max={10} value={level} onChange={(e) => setLevel(type, Number(e.target.value))} className="w-full accent-[#00E5FF] mt-2" data-testid="difficulty" />
        <p className="text-sm text-muted mt-1">{LEVEL_DESCRIPTIONS[level]} Adapts automatically after each 20-question window (≥90% accuracy and fast median → up; &lt;60% → down).</p>
      </div>
      <fieldset>
        <legend className="text-xs uppercase tracking-wider text-muted mb-2">Mode</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((x) => (
            <button key={x.key} onClick={() => setMode(x.key)} aria-pressed={mode === x.key} data-testid={`mode-${x.key}`}
              className={`text-left rounded-md border p-3 ${mode === x.key ? "border-cyan bg-elevated" : "border-border hover:border-cyan/50"}`}>
              <div className={`text-sm font-medium ${mode === x.key ? "text-cyan" : ""}`}>{x.label}</div>
              <div className="text-xs text-muted mt-0.5">{x.desc}</div>
            </button>
          ))}
        </div>
      </fieldset>
      {extraControls}
      <div><Button onClick={launch} data-testid="launch">Start {m.label.toLowerCase()}</Button></div>
      <Sample type={type} level={level} options={options} />
    </Card>
  );
}

function Sample({ type, level, options }: { type: string; level: number; options?: TrainerOptions }) {
  const q = useMemo(() => generateQuestion(type, 424242, level, options), [type, level, options]);
  return <p className="text-sm text-muted">Sample at this level: <M>{q.prompt}</M></p>;
}
