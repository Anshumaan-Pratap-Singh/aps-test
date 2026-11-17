"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { M, TexText } from "@/components/Math";
import { Button, Card, Notice, Stat } from "@/components/ui";
import { api, BatchSchema, type ServerQuestion } from "@/lib/api";
import { db, type LocalSession } from "@/lib/db";
import { randomSeed, uid } from "@/lib/rng";
import { fmtMs, fmtPct, median } from "@/lib/stats";
import { enqueueSession } from "@/lib/sync";
import { serverToDisplay } from "@/features/trainer/local";
import { usePrefs } from "@/stores/app";

type Mode = "learning" | "practice" | "assessment";

const MODE_INFO: Record<Mode, string> = {
  learning: "Full guided solutions available before you answer.",
  practice: "Hints unlock after a wrong attempt; one retry, then the solution.",
  assessment: "No hints or solutions until you submit the whole set.",
};

interface Row { q: ServerQuestion; input: string; correct: boolean | null; tries: number; ms: number; hints: number }

/** Problem engine UI for server-generated, verified problems (probability, competition). Cached for offline use. */
export function ProblemTrainer({ questionType, title, count = 10 }: { questionType: "probability" | "olympiad"; title: string; count?: number }) {
  const { levels, setLevel } = usePrefs();
  const level = levels[questionType] ?? 3;
  const [mode, setMode] = useState<Mode>("practice");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [offlineNote, setOfflineNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [hints, setHints] = useState(0);
  const [done, setDone] = useState(false);
  const qStart = useRef(0);
  const session = useRef<{ id: string; seed: number; startedAt: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setOfflineNote(null);
    const key = `batch:${questionType}:${level}`;
    let qs: ServerQuestion[] | null = null;
    try {
      const res = await api("/questions/generate", { method: "POST", json: { question_type: questionType, difficulty: level, count: 40, seed: randomSeed() } }, BatchSchema);
      await db.cacheSet(key, res.questions);
      qs = res.questions;
    } catch {
      const cached = await db.cacheGet<ServerQuestion[]>(key);
      if (cached?.length) { qs = cached; setOfflineNote("API unreachable — using your cached problem set for this level (offline mode)."); }
      else setOfflineNote("API unreachable and no cached problems for this level yet. Start the backend (see README) or try again online.");
    }
    setLoading(false);
    if (!qs) return;
    const picked = [...qs].sort(() => Math.random() - 0.5).slice(0, count);
    session.current = { id: uid(), seed: picked[0]?.seed ?? 0, startedAt: Date.now() };
    setRows(picked.map((q) => ({ q, input: "", correct: null, tries: 0, ms: 0, hints: 0 })));
    setIdx(0); setValue(""); setShowSolution(false); setHints(0); setDone(false);
    qStart.current = performance.now();
  }, [questionType, level, count, mode]);

  const persist = useCallback(async (rs: Row[]) => {
    const s = session.current;
    if (!s) return;
    const local: LocalSession = {
      id: s.id, trainer: questionType, category: "probability", mode: mode === "assessment" ? "timed" : "untimed", configKey: `problems_${mode}`,
      difficulty: level, seed: s.seed, startedAt: s.startedAt, endedAt: Date.now(), durationMs: rs.reduce((a, r) => a + r.ms, 0),
      attempts: rs.filter((r) => r.tries > 0).map((r, i) => ({
        eventId: `${s.id}-${i}`, questionId: r.q.question_id, questionType: r.q.question_type, questionVersion: r.q.generator_version, seed: r.q.seed,
        prompt: r.q.prompt_latex, answer: r.input, expected: r.q.answer_display, correct: r.correct === true && r.tries === 1 && r.hints === 0, // mastery counts first-try, hint-free answers only
        responseMs: r.ms, index: i, tags: r.q.skill_tags, at: Date.now(),
      })),
      status: "completed", serverValidated: false, synced: false,
    };
    await db.saveSession(local);
    void enqueueSession(local);
  }, [questionType, mode, level]);

  useEffect(() => { setRows(null); }, [mode, level]);

  if (!rows) {
    return (
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <fieldset>
          <legend className="text-xs uppercase tracking-wider text-muted mb-2">Mode</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`text-left rounded-md border p-3 ${mode === m ? "border-cyan bg-elevated" : "border-border"}`}>
                <div className={`text-sm font-medium capitalize ${mode === m ? "text-cyan" : ""}`}>{m}</div>
                <div className="text-xs text-muted">{MODE_INFO[m]}</div>
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="plevel" className="text-xs uppercase tracking-wider text-muted">Difficulty <span className="font-mono text-cyan">{level}</span>/10</label>
          <input id="plevel" type="range" min={1} max={10} value={level} onChange={(e) => setLevel(questionType, Number(e.target.value))} className="w-full accent-[#00E5FF]" />
        </div>
        {offlineNote && <Notice tone="warn">{offlineNote}</Notice>}
        <Button onClick={load} disabled={loading} data-testid="load-problems">{loading ? "Generating verified problems…" : `Start ${count} problems`}</Button>
        <p className="text-xs text-muted">Each problem is generated by the Python engine and verified by an independent method (exhaustive enumeration or brute force) before it is served. Answers are exact: enter fractions as a/b.</p>
      </Card>
    );
  }

  if (done) {
    const answered = rows.filter((r) => r.tries > 0);
    const firstTry = answered.filter((r) => r.correct && r.tries === 1 && r.hints === 0).length;
    return (
      <div className="space-y-4" data-testid="problem-results">
        <Card>
          <h2 className="text-lg font-semibold">Set complete</h2>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="First-try correct" value={`${firstTry}/${rows.length}`} tone="good" />
            <Stat label="Eventually correct" value={answered.filter((r) => r.correct).length} />
            <Stat label="Accuracy (first try)" value={fmtPct(rows.length ? firstTry / rows.length : null)} />
            <Stat label="Median time" value={fmtMs(median(answered.map((r) => r.ms)))} />
          </div>
          <div className="mt-3 flex gap-2"><Button onClick={load}>New set</Button><Button variant="ghost" onClick={() => setRows(null)}>Change settings</Button></div>
        </Card>
        {rows.map((r, i) => (
          <Card key={r.q.question_id}>
            <div className="flex justify-between text-xs text-muted"><span>Problem {i + 1} · {r.q.skill_tags.join(", ")}</span>
              <span className={r.correct ? "text-teal" : "text-error"}>{r.correct ? "✓" : "✗"} you: <span className="font-mono">{r.input || "—"}</span> · answer <span className="font-mono">{r.q.answer_display}</span></span></div>
            <div className="mt-2"><M>{r.q.prompt_latex}</M></div>
            <ol className="mt-2 text-sm text-muted list-decimal pl-5 space-y-1">{r.q.solution_steps.map((s, k) => <li key={k}><TexText>{/\\/.test(s) && !s.includes("$") ? `$${s}$` : s}</TexText></li>)}</ol>
          </Card>
        ))}
      </div>
    );
  }

  const row = rows[idx]!;
  const dq = serverToDisplay(row.q);
  const canHint = mode === "learning" || (mode === "practice" && row.tries > 0 && !row.correct);
  const resolved = row.correct === true || row.tries >= 2 || (mode === "assessment" && row.tries >= 1);

  const submit = () => {
    if (!value.trim() || resolved) return;
    const ok = dq.grade(value) === true;
    const ms = performance.now() - qStart.current;
    const next = rows.map((r, i) => (i === idx ? { ...r, input: value.trim(), correct: ok, tries: r.tries + 1, ms, hints } : r));
    setRows(next);
    if (mode === "assessment") advance(next);
  };

  const advance = (rs = rows) => {
    if (idx + 1 >= rs.length) { setDone(true); void persist(rs); return; }
    setIdx(idx + 1); setValue(""); setHints(0); setShowSolution(false); qStart.current = performance.now();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <Card>
        <div className="flex justify-between text-xs text-muted"><span className="font-mono">Problem {idx + 1}/{rows.length}</span><span className="capitalize">{mode} mode · L{level}</span></div>
        <div className="py-8 text-lg sm:text-xl text-center overflow-x-auto" data-testid="problem-prompt"><M>{row.q.prompt_latex}</M></div>
        <form onSubmit={(e) => { e.preventDefault(); if (resolved && mode !== "assessment") advance(); else submit(); }} className="flex flex-col items-center gap-3">
          <label htmlFor="pans" className="sr-only">Answer</label>
          <input id="pans" autoFocus value={value} onChange={(e) => setValue(e.target.value)} disabled={resolved && mode !== "assessment"}
            className="w-56 rounded-md border border-border bg-bg px-3 py-2 text-center font-mono text-xl focus:border-cyan focus:outline-none" placeholder="a/b" autoComplete="off" />
          {resolved && mode !== "assessment" ? <Button type="submit">Next problem (Enter)</Button> : <Button type="submit">Submit</Button>}
        </form>
        {mode !== "assessment" && row.tries > 0 && (
          <p className={`mt-4 text-center text-sm ${row.correct ? "text-teal" : "text-error"}`}>
            {row.correct ? "✓ Correct" : row.tries >= 2 ? <>✗ Answer: <span className="font-mono">{row.q.answer_display}</span></> : "✗ Not quite — hints are now available; one more try."}
          </p>
        )}
        {mode !== "assessment" && (
          <div className="mt-4 space-y-2 text-sm">
            {row.q.hint_steps.slice(0, hints).map((h, i) => <p key={i} className="text-blue"><span className="text-muted">Hint {i + 1}: </span><TexText>{h}</TexText></p>)}
            <div className="flex flex-wrap gap-3">
              {canHint && hints < row.q.hint_steps.length && <button className="text-xs text-muted hover:text-cyan underline" onClick={() => setHints(hints + 1)}>Hint {hints + 1}</button>}
              {(mode === "learning" || resolved) && <button className="text-xs text-muted hover:text-cyan underline" onClick={() => setShowSolution(!showSolution)}>{showSolution ? "Hide" : "Show"} full solution</button>}
            </div>
            {showSolution && <ol className="list-decimal pl-5 text-muted space-y-1">{row.q.solution_steps.map((s, k) => <li key={k}><TexText>{/\\/.test(s) && !s.includes("$") ? `$${s}$` : s}</TexText></li>)}</ol>}
          </div>
        )}
      </Card>
      <div className="space-y-2">
        <Stat label="Answered" value={rows.filter((r) => r.tries > 0).length} />
        {mode !== "assessment" && <Stat label="Correct" value={rows.filter((r) => r.correct).length} tone="good" />}
        <Button variant="ghost" onClick={() => { setDone(true); void persist(rows); }}>Finish set</Button>
      </div>
    </div>
  );
}
