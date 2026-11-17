"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { M } from "@/components/Math";
import { Button, Card, Stat } from "@/components/ui";
import { db, type LocalSession } from "@/lib/db";
import { randomSeed, uid } from "@/lib/rng";
import { targetRtMs } from "@/lib/adaptive";
import { enqueueSession } from "@/lib/sync";
import { checkAnswer, generateQuestion, type Question } from "@/features/trainer/generators";
import { usePrefs } from "@/stores/app";

/**
 * Baseline: a short staircase per section. Start at level 3; a correct answer within
 * the level's target time moves up one level, an error moves down one. After 8 items,
 * the estimated level is the median level of the last 4 items presented.
 */
const SECTIONS = [
  { trainer: "mixed", label: "Arithmetic", applyTo: ["mixed", "multiplication", "division", "add_sub", "decimal_mult", "decimal_div", "percent_of", "missing_operand"] },
  { trainer: "sequence", label: "Sequences", applyTo: ["sequence"] },
  { trainer: "fraction_conversion", label: "Fractions", applyTo: ["fraction_conversion"] },
] as const;
const ITEMS = 8;

export function Baseline() {
  const { setLevel, setBaselineDone } = usePrefs();
  const [sec, setSec] = useState(-1);
  const [item, setItem] = useState(0);
  const [level, setLvl] = useState(3);
  const [q, setQ] = useState<Question | null>(null);
  const [value, setValue] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const [results, setResults] = useState<Record<string, number>>({});
  const seed = useRef(randomSeed());
  const t0 = useRef(0);
  const attempts = useRef<LocalSession["attempts"]>([]);
  const startedAt = useRef(Date.now());

  const present = (s: number, i: number, lvl: number) => {
    const qn = generateQuestion(SECTIONS[s]!.trainer, seed.current * 1000 + s * 100 + i, lvl);
    setQ(qn); setValue(""); t0.current = performance.now();
  };

  const begin = () => { startedAt.current = Date.now(); setSec(0); setItem(0); setLvl(3); setLevels([]); present(0, 0, 3); };

  const submit = () => {
    if (!q || !value.trim()) return;
    const rt = performance.now() - t0.current;
    const ok = checkAnswer(q, value);
    attempts.current.push({ eventId: uid(), questionId: q.id, questionType: q.type, questionVersion: q.version, seed: q.seed, prompt: q.prompt, answer: value.trim(),
      expected: q.answerDisplay, correct: ok, responseMs: rt, index: attempts.current.length, tags: q.tags, at: Date.now() });
    const lv = [...levels, level];
    const nextLevel = ok && rt <= targetRtMs(level) ? Math.min(10, level + 1) : ok ? level : Math.max(1, level - 1);
    if (item + 1 < ITEMS) { setLevels(lv); setItem(item + 1); setLvl(nextLevel); present(sec, item + 1, nextLevel); return; }
    const last = lv.slice(-4).sort((a, b) => a - b);
    const est = Math.round(((last[1] ?? 3) + (last[2] ?? 3)) / 2);
    const res = { ...results, [SECTIONS[sec]!.trainer]: est };
    setResults(res);
    for (const t of SECTIONS[sec]!.applyTo) setLevel(t, est);
    if (sec + 1 < SECTIONS.length) { setSec(sec + 1); setItem(0); setLvl(3); setLevels([]); present(sec + 1, 0, 3); }
    else {
      setSec(SECTIONS.length); setBaselineDone(true);
      const s: LocalSession = { id: uid(), trainer: "baseline", category: "baseline", mode: "untimed", configKey: "baseline", difficulty: 3, seed: seed.current,
        startedAt: startedAt.current, endedAt: Date.now(), durationMs: attempts.current.reduce((a, x) => a + x.responseMs, 0), attempts: attempts.current,
        status: "completed", serverValidated: false, synced: false };
      void db.saveSession(s).then(() => enqueueSession(s));
    }
  };

  if (sec < 0) return (
    <Card className="space-y-3">
      <p className="text-sm text-muted">Three short sections (arithmetic, sequences, fractions), 8 items each. Difficulty adapts after every answer. Your estimated level per section becomes the starting level of the matching trainers. Probability is calibrated from your first problem sets.</p>
      <Button onClick={begin} data-testid="start-baseline">Begin baseline</Button>
    </Card>
  );
  if (sec >= SECTIONS.length) return (
    <Card className="space-y-3" data-testid="baseline-done">
      <h2 className="text-lg font-semibold">Baseline complete</h2>
      <div className="grid grid-cols-3 gap-2">{SECTIONS.map((s) => <Stat key={s.trainer} label={s.label} value={`L${results[s.trainer]}`} tone="accent" />)}</div>
      <p className="text-sm text-muted">These levels are now your starting difficulty and will keep adapting with practice.</p>
      <Link href="/" className="text-cyan text-sm">Go to dashboard →</Link>
    </Card>
  );
  return (
    <Card className="text-center space-y-4" data-testid="baseline-run">
      <div className="text-xs text-muted flex justify-between"><span>{SECTIONS[sec]!.label} · item {item + 1}/{ITEMS}</span><span>Level {level}</span></div>
      <div className="py-8 text-3xl">{q && <M>{q.prompt}</M>}</div>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex justify-center gap-2">
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="Answer" data-testid="baseline-input" inputMode="decimal" autoComplete="off"
          className="w-48 rounded-md border border-border bg-bg px-3 py-2 text-center font-mono text-xl focus:border-cyan focus:outline-none" placeholder={q?.inputType === "choice" ? q.choices?.join(" / ") : ""} />
        <Button type="submit">Enter</Button>
      </form>
    </Card>
  );
}
