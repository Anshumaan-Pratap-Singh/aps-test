"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { db, type LocalGame } from "@/lib/db";
import { randomSeed, Rng, uid } from "@/lib/rng";
import { fmtMs, fmtPct, median } from "@/lib/stats";
import { enqueueGame } from "@/lib/sync";
import { MetricGrid } from "@/features/games/GameShell";
import {
  classifyPinError, cognitiveScore, conflictMetrics, conflictTrials, nextLength, PIN_LABEL, pinTrial, taskSwitchMetrics, taskSwitchTrials,
  type PinError, type PinTransform, type TrialResult,
} from "./design";
import { ResponsePads, useTrialRunner } from "./useTrialRunner";

async function saveCognitive(gameType: string, seed: number, difficulty: number, startedAt: number, score: number, metrics: LocalGame["metrics"], events: LocalGame["events"]) {
  const g: LocalGame = { id: uid(), gameType, category: "cognitive", difficulty, seed, startedAt, endedAt: Date.now(), score, metrics, events,
    initialState: { seed, difficulty }, finalState: {}, synced: false };
  await db.saveGame(g);
  void enqueueGame(g);
}

function Setup({ title, children, onStart }: { title: string; children: React.ReactNode; onStart: (d: number) => void }) {
  const [d, setD] = useState(4);
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-sm text-muted space-y-2">{children}</div>
      <label className="block text-xs uppercase tracking-wider text-muted">Difficulty <span className="font-mono text-cyan">{d}</span>/10
        <input type="range" min={1} max={10} value={d} onChange={(e) => setD(Number(e.target.value))} className="block w-full accent-[#00E5FF]" /></label>
      <Button onClick={() => onStart(d)} data-testid="start-game">Start</Button>
    </Card>
  );
}

// --------------------------------------------------------------- Task switch
export function TaskSwitchGame() {
  const [cfg, setCfg] = useState<{ seed: number; d: number; startedAt: number } | null>(null);
  const trials = useMemo(() => (cfg ? taskSwitchTrials(cfg.seed, cfg.d, 40) : []), [cfg]);
  const [done, setDone] = useState<TrialResult[] | null>(null);
  const onDone = useCallback((rs: TrialResult[]) => {
    const res = [...rs];
    setDone(res);
    if (!cfg) return;
    const m = taskSwitchMetrics(trials, res);
    void saveCognitive("task_switch", cfg.seed, cfg.d, cfg.startedAt, cognitiveScore(m.accuracy, m.medianRt), m as LocalGame["metrics"],
      res.map((r, i) => ({ seq: i, type: "trial", payload: { ...trials[i], ...r }, t: 0 })));
  }, [cfg, trials]);
  const run = useTrialRunner(trials, onDone);

  if (!cfg) return (
    <Setup title="Task Switch" onStart={(d) => { setDone(null); setCfg({ seed: randomSeed(), d, startedAt: Date.now() }); }}>
      <p>A digit (1–9, never 5) appears inside a coloured frame. The frame tells you the rule:</p>
      <ul className="list-disc pl-5"><li><span className="text-cyan">Cyan frame — PARITY</span>: odd → LEFT (F), even → RIGHT (J).</li><li><span className="text-blue">Blue frame — MAGNITUDE</span>: below 5 → LEFT (F), above 5 → RIGHT (J).</li></ul>
      <p>Rules switch unpredictably. Half the trials are <em>incongruent</em> (the two rules disagree). The response deadline tightens through the session. Every trial has exactly one correct answer.</p>
    </Setup>
  );
  if (done) {
    const m = taskSwitchMetrics(trials, done);
    return (
      <Card className="space-y-4" data-testid="game-results">
        <div className="flex justify-between"><h2 className="text-lg font-semibold">Task Switch results</h2><span className="font-mono text-2xl text-teal" data-testid="game-score">{cognitiveScore(m.accuracy, m.medianRt).toFixed(1)}</span></div>
        <MetricGrid items={[
          { label: "Accuracy", value: fmtPct(m.accuracy, 1) }, { label: "Median RT", value: fmtMs(m.medianRt) }, { label: "RT variability (SD)", value: fmtMs(m.rtSd) },
          { label: "Switch cost", value: m.switchCost == null ? "—" : `${Math.round(m.switchCost)}ms`, sub: "median RT switch − repeat (correct)" },
          { label: "Accuracy after switch", value: fmtPct(m.switchAccuracy, 1), sub: `repeat ${fmtPct(m.repeatAccuracy, 1)}` },
          { label: "Incongruent accuracy", value: fmtPct(m.incongruentAccuracy, 1), sub: `congruent ${fmtPct(m.congruentAccuracy, 1)}` },
          { label: "Errors under pressure", value: fmtPct(m.pressureErrorRate, 1), sub: "error rate, tightest third" }, { label: "Omissions", value: m.omissions },
        ]} />
        <Button onClick={() => { setDone(null); setCfg({ seed: randomSeed(), d: cfg.d, startedAt: Date.now() }); }} data-testid="play-again">Again</Button>
      </Card>
    );
  }
  const t = run.index >= 0 ? trials[run.index] : null;
  return (
    <Card data-testid="task-switch">
      {run.index < 0 ? <div className="text-center py-10"><Button onClick={run.start} data-testid="begin-trials">Begin (40 trials)</Button><p className="text-xs text-muted mt-2">Use F / J or the pads below.</p></div> : (
        <>
          <div className="text-xs text-muted flex justify-between"><span>Trial {Math.min(run.index + 1, trials.length)}/{trials.length}</span><span>{run.lastCorrect === null ? "" : run.lastCorrect ? "✓" : "✗"}</span></div>
          <div className="flex justify-center py-10">
            <div className={`flex h-36 w-36 items-center justify-center rounded-xl border-4 ${t?.rule === "parity" ? "border-cyan" : "border-blue"}`} data-testid="ts-stimulus" data-rule={t?.rule}>
              {run.phase === "stimulus" && t && <span className="font-mono text-6xl">{t.n}</span>}
            </div>
          </div>
          <p className="text-center text-xs text-muted">{t?.rule === "parity" ? "PARITY: odd ← · → even" : "MAGNITUDE: <5 ← · → >5"}</p>
          <ResponsePads onRespond={run.respond} left="odd / < 5" right="even / > 5" />
        </>
      )}
    </Card>
  );
}

// -------------------------------------------------------- Response conflict
export function ConflictGame() {
  const [cfg, setCfg] = useState<{ seed: number; d: number; startedAt: number } | null>(null);
  const trials = useMemo(() => (cfg ? conflictTrials(cfg.seed, cfg.d, 10) : []), [cfg]);
  const [done, setDone] = useState<TrialResult[] | null>(null);
  const onDone = useCallback((rs: TrialResult[]) => {
    const res = [...rs];
    setDone(res);
    if (!cfg) return;
    const m = conflictMetrics(trials, res);
    const accAll = res.filter((r) => r.correct).length / res.length;
    void saveCognitive("response_conflict", cfg.seed, cfg.d, cfg.startedAt, cognitiveScore(accAll, m.medianRt, 700), m as LocalGame["metrics"],
      res.map((r, i) => ({ seq: i, type: "trial", payload: { ...trials[i], ...r }, t: 0 })));
  }, [cfg, trials]);
  const run = useTrialRunner(trials, onDone);

  if (!cfg) return (
    <Setup title="Response Conflict (Flanker + Simon)" onStart={(d) => { setDone(null); setCfg({ seed: randomSeed(), d, startedAt: Date.now() }); }}>
      <p><strong>Arrow rows</strong>: respond to the <em>centre</em> arrow only (← = LEFT/F, → = RIGHT/J); ignore the flankers.</p>
      <p><strong>Coloured squares</strong>: respond to the <em>colour</em> only — <span className="text-cyan">cyan = LEFT</span>, <span className="text-blue">blue = RIGHT</span> — ignore which side of the screen it appears on.</p>
      <p>40 trials, balanced: equal congruent and incongruent trials of each type, no more than three of the same condition in a row.</p>
    </Setup>
  );
  if (done) {
    const m = conflictMetrics(trials, done);
    return (
      <Card className="space-y-4" data-testid="game-results">
        <h2 className="text-lg font-semibold">Response Conflict results</h2>
        <MetricGrid items={[
          { label: "Congruent accuracy", value: fmtPct(m.congruentAccuracy, 1) }, { label: "Incongruent accuracy", value: fmtPct(m.incongruentAccuracy, 1) },
          { label: "Median RT", value: fmtMs(m.medianRt), sub: `cong ${fmtMs(m.medianRtCongruent)} · incong ${fmtMs(m.medianRtIncongruent)}` },
          { label: "Congruency effect", value: m.congruencyEffect == null ? "—" : `${Math.round(m.congruencyEffect)}ms`, sub: "incongruent − congruent median RT" },
          { label: "Flanker effect", value: m.flankerEffect == null ? "—" : `${Math.round(m.flankerEffect)}ms` }, { label: "Simon effect", value: m.simonEffect == null ? "—" : `${Math.round(m.simonEffect)}ms` },
          { label: "Commission errors", value: m.commissionErrors, sub: "wrong response" }, { label: "Omission errors", value: m.omissionErrors, sub: "no response by deadline" },
        ]} />
        <span className="hidden" data-testid="game-score">{cognitiveScore(done.filter((r) => r.correct).length / done.length, m.medianRt, 700).toFixed(1)}</span>
        <Button onClick={() => { setDone(null); setCfg({ seed: randomSeed(), d: cfg.d, startedAt: Date.now() }); }} data-testid="play-again">Again</Button>
      </Card>
    );
  }
  const t = run.index >= 0 ? trials[run.index] : null;
  return (
    <Card data-testid="conflict-game">
      {run.index < 0 ? <div className="text-center py-10"><Button onClick={run.start} data-testid="begin-trials">Begin (40 trials)</Button></div> : (
        <>
          <div className="text-xs text-muted">Trial {Math.min(run.index + 1, trials.length)}/{trials.length}</div>
          <div className="relative h-40 my-6 flex items-center" data-testid="rc-stimulus">
            {run.phase === "stimulus" && t && (t.kind === "flanker"
              ? <span className="mx-auto font-mono text-5xl tracking-[0.3em]">{t.display}</span>
              : <span className={`absolute h-20 w-20 rounded-md ${t.display === "cyan" ? "bg-cyan" : "bg-blue"} ${t.position === "L" ? "left-[10%]" : "right-[10%]"}`} aria-label={`${t.display} square on the ${t.position === "L" ? "left" : "right"}`} />)}
            {run.phase !== "stimulus" && <span className="mx-auto text-2xl text-muted">+</span>}
          </div>
          <ResponsePads onRespond={run.respond} left="← / cyan" right="→ / blue" />
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------- Pincode
interface PinRecord { length: number; transform: PinTransform; correct: boolean; rt: number; error: PinError; expected: string; given: string }

export function PincodeGame() {
  const TRIALS = 12;
  const [cfg, setCfg] = useState<{ seed: number; d: number; startedAt: number } | null>(null);
  const [len, setLen] = useState(4);
  const [streak, setStreak] = useState(0);
  const [records, setRecords] = useState<PinRecord[]>([]);
  const [stage, setStage] = useState<"show" | "answer" | "feedback" | "done">("show");
  const [value, setValue] = useState("");
  const answerStart = useRef(0);
  const shownFor = useRef(0);
  const trial = useMemo(() => (cfg ? pinTrial(new Rng(`pin:${cfg.seed}:${records.length}`), len, cfg.d) : null), [cfg, records.length, len]);
  const displayMs = cfg ? Math.max(350, 900 - 50 * cfg.d) * len : 0;

  // Memorisation: digits are rendered once; a single timer hides them. Actual on-screen time is measured from paint.
  useEffect(() => {
    if (stage !== "show" || !trial) return;
    let painted = 0;
    const raf = requestAnimationFrame(() => { painted = performance.now(); });
    const to = window.setTimeout(() => { shownFor.current = performance.now() - painted; setStage("answer"); answerStart.current = performance.now(); }, displayMs);
    return () => { cancelAnimationFrame(raf); clearTimeout(to); };
  }, [stage, trial, displayMs]);

  if (!cfg) return (
    <Setup title="Pincode (working memory)" onStart={(d) => { setCfg({ seed: randomSeed(), d, startedAt: Date.now() }); setLen(d <= 3 ? 4 : 5); setStreak(0); setRecords([]); setStage("show"); }}>
      <p>A digit sequence is shown briefly, then hidden. Type it back after applying the requested transformation: forwards, backwards, sorted, even/odd digits only, selected positions or +1 to each digit.</p>
      <p>Sequence length adapts with a 2-up / 1-down staircase. At difficulty ≥ 5 the transformation is revealed only <em>after</em> the digits disappear.</p>
    </Setup>
  );

  if (stage === "done" || records.length >= TRIALS) {
    const maxLen = Math.max(0, ...records.filter((r) => r.correct).map((r) => r.length));
    const accuracy = records.filter((r) => r.correct).length / Math.max(1, records.length);
    const byT = Object.entries(records.reduce<Record<string, { n: number; c: number }>>((a, r) => { const e = a[r.transform] ?? { n: 0, c: 0 }; e.n++; if (r.correct) e.c++; a[r.transform] = e; return a; }, {}));
    const errs = records.reduce<Record<string, number>>((a, r) => { if (r.error !== "none") a[r.error] = (a[r.error] ?? 0) + 1; return a; }, {});
    return (
      <Card className="space-y-4" data-testid="game-results">
        <div className="flex justify-between"><h2 className="text-lg font-semibold">Pincode results</h2><span className="font-mono text-2xl text-teal" data-testid="game-score">{Math.min(100, maxLen * 8 * accuracy + 4 * maxLen).toFixed(1)}</span></div>
        <MetricGrid items={[
          { label: "Max length (correct)", value: maxLen, tone: "accent" }, { label: "Recall accuracy", value: fmtPct(accuracy, 1) },
          { label: "Median response", value: fmtMs(median(records.map((r) => r.rt))) },
          { label: "Error types", value: Object.keys(errs).length ? Object.entries(errs).map(([k, v]) => `${k} ${v}`).join(", ") : "none" },
        ]} />
        <table className="w-full text-sm"><thead className="text-xs text-muted text-left"><tr><th>Transformation</th><th>Trials</th><th>Accuracy</th></tr></thead>
          <tbody>{byT.map(([k, v]) => <tr key={k} className="border-t border-border"><td className="py-1">{PIN_LABEL[k as PinTransform]}</td><td className="font-mono">{v.n}</td><td className="font-mono">{fmtPct(v.c / v.n)}</td></tr>)}</tbody></table>
        <Button onClick={() => { setCfg({ seed: randomSeed(), d: cfg.d, startedAt: Date.now() }); setRecords([]); setStage("show"); setLen(cfg.d <= 3 ? 4 : 5); setStreak(0); }} data-testid="play-again">Again</Button>
      </Card>
    );
  }

  if (!trial) return null;
  const instruction = trial.transform === "positions" ? `${PIN_LABEL.positions}: ${trial.positions.join(" and ")}` : PIN_LABEL[trial.transform];

  const submit = () => {
    const given = value.replace(/\D/g, "");
    const correct = given === trial.answer;
    const rec: PinRecord = { length: len, transform: trial.transform, correct, rt: performance.now() - answerStart.current, error: classifyPinError(trial.answer, given), expected: trial.answer, given };
    const next = [...records, rec];
    setRecords(next);
    const n = nextLength(len, streak, correct);
    setValue("");
    setStage("feedback");
    window.setTimeout(() => {
      setLen(n.len); setStreak(n.streak);
      if (next.length >= TRIALS) {
        setStage("done");
        const maxLen = Math.max(0, ...next.filter((r) => r.correct).map((r) => r.length));
        const acc = next.filter((r) => r.correct).length / next.length;
        void saveCognitive("pincode", cfg.seed, cfg.d, cfg.startedAt, Math.min(100, maxLen * 8 * acc + 4 * maxLen), { maxLength: maxLen, accuracy: acc, medianRt: median(next.map((r) => r.rt)) },
          next.map((r, i) => ({ seq: i, type: "trial", payload: { ...r }, t: 0 })));
      } else setStage("show");
    }, 900);
  };

  return (
    <Card className="text-center" data-testid="pincode-game">
      <div className="text-xs text-muted flex justify-between"><span>Trial {records.length + 1}/{TRIALS}</span><span>Length {len}</span></div>
      {(trial.showTransformFirst || stage !== "show") && <p className="mt-3 text-sm text-cyan" data-testid="pin-instruction">{instruction}</p>}
      <div className="my-8 h-16 font-mono text-5xl tracking-[0.35em]" aria-live="off" data-testid="pin-digits">{stage === "show" ? trial.digits.join("") : stage === "feedback" ? "" : "• ".repeat(len).trim()}</div>
      {stage === "answer" && (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex justify-center gap-2">
          <label htmlFor="pin" className="sr-only">Answer</label>
          <input id="pin" autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} data-testid="pin-input" className="w-56 rounded-md border border-border bg-bg px-3 py-2 text-center font-mono text-2xl tracking-widest focus:border-cyan focus:outline-none" autoComplete="off" />
          <Button type="submit">Enter</Button>
        </form>
      )}
      {stage === "feedback" && records.length > 0 && (() => { const r = records[records.length - 1]!; return <p className={r.correct ? "text-teal" : "text-error"}>{r.correct ? "✓ Correct" : `✗ Expected ${r.expected} (${r.error})`}</p>; })()}
      <Notice>Shown for {(displayMs / 1000).toFixed(1)}s ({Math.max(350, 900 - 50 * cfg.d)}ms per digit).</Notice>
    </Card>
  );
}
