"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { M, TexText } from "@/components/Math";
import { Countdown } from "@/components/Countdown";
import { Button, Card, Stat } from "@/components/ui";
import { db, type LocalSession } from "@/lib/db";
import { fmtMs, fmtPct, median } from "@/lib/stats";
import type { DisplayQuestion } from "./engine";
import { useTrainer, type TrainerSessionMeta } from "./useTrainer";

export interface ConsoleProps {
  meta: TrainerSessionMeta;
  questionAt: (i: number) => DisplayQuestion;
  questionLimit?: number;
  durationMs?: number;
  /** Show correctness + solution after each answer (off for assessments). */
  showFeedback: boolean;
  autoStart?: boolean;
  onFinish?: (s: LocalSession) => void;
  onRetryMistakes?: (wrong: LocalSession["attempts"]) => void;
  onExit?: () => void;
  resultsExtra?: (s: LocalSession) => React.ReactNode;
  /** Enable the staged hint ladder (practice only). */
  allowHints?: boolean;
  /** Grouping key for the per-category results table. */
  groupBy?: (a: LocalSession["attempts"][number]) => string;
}

export function TrainerConsole(props: ConsoleProps) {
  const { meta, questionAt, questionLimit, durationMs, showFeedback, autoStart, onFinish, onRetryMistakes, onExit, resultsExtra, allowHints, groupBy } = props;
  const t = useTrainer({ meta, questionAt, questionLimit, durationMs, onFinish });
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const keyTs = useRef(0);
  const [hintLevel, setHintLevel] = useState(0);
  useEffect(() => setHintLevel(0), [t.index]);

  useEffect(() => { if (autoStart && t.phase === "ready") t.start(); }, [autoStart, t]);
  // Keep the visible input focused while running.
  useEffect(() => { if (t.phase === "running") inputRef.current?.focus(); }, [t.phase, t.index]);

  const getRemaining = useCallback(() => t.engineRef.current?.remaining() ?? null, [t.engineRef]);
  const getElapsed = useCallback(() => t.engineRef.current?.elapsed() ?? 0, [t.engineRef]);

  const submitValue = (v: string) => {
    if (t.submit(v, keyTs.current || performance.now())) setValue("");
    keyTs.current = 0;
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); submitValue(value); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { keyTs.current = e.timeStamp || performance.now(); if (e.repeat) e.preventDefault(); }
    const q = t.question;
    if (q?.inputType === "choice" && q.choices) {
      const n = Number(e.key);
      if (n >= 1 && n <= q.choices.length) { e.preventDefault(); keyTs.current = e.timeStamp; submitValue(q.choices[n - 1] as string); }
    }
  };

  if (t.phase === "ready") {
    return (
      <Card className="text-center py-10">
        <p className="text-muted text-sm mb-4">
          {questionLimit ? `${questionLimit} questions` : "Unlimited questions"}
          {durationMs ? ` · ${Math.round(durationMs / 1000)}s time limit` : " · untimed"}
          {showFeedback ? " · instant feedback" : " · no feedback until the end"}
        </p>
        <Button onClick={t.start} data-testid="start-session">Start session</Button>
        <p className="mt-3 text-xs text-muted">Type your answer and press Enter. Fractions as a/b. Choice questions accept keys 1–4.</p>
      </Card>
    );
  }

  if (t.phase === "finished" && t.final) {
    return <Results session={t.final} showAnswers={showFeedback || meta.mode !== "assessment"} onRestart={t.start}
      onRetryMistakes={onRetryMistakes} onExit={onExit} extra={resultsExtra?.(t.final)} groupBy={groupBy} />;
  }

  const q = t.question;
  const s = t.stats;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]" data-testid="trainer-console">
      <Card className={`relative ${t.feedback && showFeedback ? (t.feedback.correct ? "flash-ok" : t.feedback.correct === false ? "flash-bad" : "") : ""}`} key={t.feedback?.key}>
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-mono num" data-testid="question-index">Q{t.index + 1}{questionLimit ? ` / ${questionLimit}` : ""}</span>
          <span className="flex items-center gap-3">
            <span className={`text-base ${durationMs ? "text-cyan" : ""}`} title={durationMs ? "Time remaining" : "Elapsed"}>
              <Countdown running getRemaining={getRemaining} getElapsed={getElapsed} onExpire={t.onExpire} />
            </span>
            <button onClick={t.quit} className="text-muted hover:text-error text-xs underline-offset-2 hover:underline">End session</button>
          </span>
        </div>
        <div className="py-10 sm:py-14 text-center text-2xl sm:text-4xl overflow-x-auto" data-testid="question-prompt" aria-live="polite">
          {q && <M>{q.prompt}</M>}
        </div>
        <form onSubmit={onSubmit} className="flex flex-col items-center gap-3">
          <label htmlFor="answer" className="sr-only">Your answer</label>
          <input
            id="answer" ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKeyDown}
            inputMode={q?.inputType === "choice" ? "none" : "decimal"} autoComplete="off" autoCorrect="off" spellCheck={false}
            enterKeyHint="go" data-testid="answer-input" aria-describedby="answer-help"
            className="w-full max-w-xs rounded-md border border-border bg-bg px-4 py-3 text-center font-mono num text-2xl text-text focus:border-cyan focus:outline-none"
            placeholder={q?.inputType === "fraction" ? "a/b" : q?.inputType === "choice" ? "press 1–4" : "answer"}
          />
          <span id="answer-help" className="sr-only">Press Enter to submit.</span>
          {q?.inputType === "choice" && q.choices && (
            <div className="flex gap-2">
              {q.choices.map((c, i) => (
                <button key={c} type="button" onClick={() => submitValue(c)} className="min-w-12 rounded-md border border-border px-3 py-2 font-mono text-lg hover:border-cyan">
                  <span className="text-xs text-muted mr-1">{i + 1}</span>{c}
                </button>
              ))}
            </div>
          )}
          <button type="submit" className="sr-only">Submit</button>
        </form>
        {allowHints && q && q.hints.length > 0 && (
          <div className="mt-4 text-center text-sm">
            {q.hints.slice(0, hintLevel).map((h, i) => <p key={i} className="text-blue"><span className="text-muted">Hint {i + 1}: </span><TexText>{h}</TexText></p>)}
            {hintLevel < q.hints.length && (
              <button type="button" onClick={() => { setHintLevel((h) => h + 1); inputRef.current?.focus(); }} className="mt-1 text-xs text-muted hover:text-cyan underline-offset-2 hover:underline" data-testid="hint">
                Show hint {hintLevel + 1} of {q.hints.length}
              </button>
            )}
          </div>
        )}
        <div className="mt-6 min-h-12 text-sm" aria-live="polite" data-testid="feedback">
          {t.feedback && showFeedback && (
            <div className={t.feedback.correct ? "text-teal" : "text-error"}>
              {t.feedback.correct ? "✓ Correct" : <>✗ <M>{t.feedback.prompt}</M> → <span className="font-mono">{t.feedback.expected}</span> (you: <span className="font-mono">{t.feedback.input}</span>)</>}
              {!t.feedback.correct && t.feedback.solution[0] && <div className="text-muted mt-1 text-xs"><M>{t.feedback.solution[0]}</M></div>}
            </div>
          )}
          {t.feedback && !showFeedback && <div className="text-muted">Answer recorded.</div>}
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 content-start" data-testid="live-stats">
        {showFeedback ? (
          <>
            <Stat label="Correct" value={<span data-testid="stat-correct">{s?.correct ?? 0}</span>} tone="good" sub={`${s?.incorrect ?? 0} incorrect`} />
            <Stat label="Accuracy" value={fmtPct(s?.accuracy ?? null)} />
            <Stat label="Streak" value={s?.streak ?? 0} sub={`best ${s?.bestStreak ?? 0}`} tone="accent" />
            <Stat label="Median RT" value={fmtMs(s?.medianMs)} />
          </>
        ) : (
          <Stat label="Answered" value={<span data-testid="stat-answered">{s?.attempts ?? 0}</span>} />
        )}
        <Stat label="Q / min" value={(s?.qpm ?? 0).toFixed(1)} />
      </div>
    </div>
  );
}

function Results({ session, showAnswers, onRestart, onRetryMistakes, onExit, extra, groupBy }: {
  session: LocalSession; showAnswers: boolean; onRestart: () => void; onRetryMistakes?: ConsoleProps["onRetryMistakes"]; onExit?: () => void; extra?: React.ReactNode;
  groupBy?: ConsoleProps["groupBy"];
}) {
  const [prev, setPrev] = useState<LocalSession[]>([]);
  useEffect(() => {
    void db.allSessions().then((all) => setPrev(all.filter((x) => x.id !== session.id && x.trainer === session.trainer && x.difficulty === session.difficulty && x.status === "completed" && x.mode === session.mode).slice(0, 10)));
  }, [session]);

  const a = session.attempts;
  const graded = a.filter((x) => x.correct !== null);
  const correct = graded.filter((x) => x.correct).length;
  const rts = a.map((x) => x.responseMs);
  const correctRts = a.filter((x) => x.correct).map((x) => x.responseMs);
  let best = 0, cur = 0;
  for (const x of a) { if (x.correct) { cur++; best = Math.max(best, cur); } else cur = 0; }
  const qpm = session.durationMs > 0 ? a.length / (session.durationMs / 60000) : 0;
  const acc = graded.length ? correct / graded.length : null;
  const prevAcc = prev.length ? median(prev.map((p) => p.attempts.filter((x) => x.correct).length / Math.max(1, p.attempts.length))) : null;
  const prevMed = prev.length ? median(prev.map((p) => median(p.attempts.map((x) => x.responseMs)) ?? 0)) : null;

  const byType = useMemo(() => {
    const m = new Map<string, { n: number; c: number; rts: number[] }>();
    for (const x of a) {
      const k = groupBy ? groupBy(x) : x.questionType;
      const e = m.get(k) ?? { n: 0, c: 0, rts: [] };
      e.n++; if (x.correct) e.c++; e.rts.push(x.responseMs);
      m.set(k, e);
    }
    return [...m.entries()];
  }, [a, groupBy]);

  const wrong = a.filter((x) => x.correct === false);
  const pending = graded.length < a.length;

  return (
    <div className="space-y-4" data-testid="session-results">
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Session complete</h2>
          <span className="text-xs text-muted">{session.serverValidated ? "Server-validated" : pending ? "Awaiting server grading" : "Practice · graded locally"}</span>
        </div>
        {pending ? (
          <p className="mt-2 text-sm text-muted">This is a server-graded assessment. Results appear once the attempts sync{session.serverResult ? "" : " (sign in and stay online)"}.
            {session.serverResult && <span className="block mt-2 text-text">Server result: <span className="font-mono text-teal">{session.serverResult.correct}/{session.serverResult.total}</span> · net score {session.serverResult.score}</span>}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            <Stat label="Attempted" value={<span data-testid="result-attempted">{a.length}</span>} />
            <Stat label="Correct" value={<span data-testid="result-correct">{correct}</span>} tone="good" sub={`${a.length - correct} incorrect`} />
            <Stat label="Accuracy" value={fmtPct(acc, 1)} sub={prevAcc != null ? `prev median ${fmtPct(prevAcc)}` : "first session"} />
            <Stat label="Median RT" value={fmtMs(median(rts))} sub={prevMed != null ? `prev ${fmtMs(prevMed)}` : undefined} />
            <Stat label="Mean RT" value={fmtMs(rts.length ? rts.reduce((x, y) => x + y, 0) / rts.length : null)} />
            <Stat label="Fastest ✓" value={fmtMs(correctRts.length ? Math.min(...correctRts) : null)} />
            <Stat label="Q / min" value={qpm.toFixed(1)} />
            <Stat label="Best streak" value={best} tone="accent" />
            <Stat label="Net score" value={correct - (a.length - correct)} sub="+1 correct, −1 wrong" tone="accent" />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onRestart} data-testid="restart">New session</Button>
          {onRetryMistakes && wrong.length > 0 && <Button variant="ghost" onClick={() => onRetryMistakes(wrong)}>Retry {wrong.length} mistakes</Button>}
          {onExit && <Button variant="ghost" onClick={onExit}>Change settings</Button>}
        </div>
      </Card>
      {extra}
      {!pending && byType.length > 1 && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">By question type</h3>
          <table className="w-full text-sm">
            <thead className="text-muted text-xs text-left"><tr><th className="py-1">Type</th><th>Attempts</th><th>Accuracy</th><th>Median RT</th></tr></thead>
            <tbody className="font-mono num">
              {byType.map(([k, v]) => (<tr key={k} className="border-t border-border"><td className="py-1 font-sans">{k}</td><td>{v.n}</td><td>{fmtPct(v.c / v.n)}</td><td>{fmtMs(median(v.rts))}</td></tr>))}
            </tbody>
          </table>
        </Card>
      )}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Answer history</h3>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-muted text-xs text-left sticky top-0 bg-surface"><tr><th className="py-1">#</th><th>Question</th><th>You</th>{showAnswers && <th>Answer</th>}<th className="text-right">Time</th></tr></thead>
            <tbody>
              {a.map((x) => (
                <tr key={x.eventId} className="border-t border-border">
                  <td className="py-1 font-mono num text-muted">{x.index + 1}</td>
                  <td className="py-1"><M>{x.prompt}</M></td>
                  <td className={`font-mono ${x.correct === true ? "text-teal" : x.correct === false ? "text-error" : ""}`}>{x.answer}</td>
                  {showAnswers && <td className="font-mono text-muted">{x.expected ?? "—"}</td>}
                  <td className="text-right font-mono num text-muted">{fmtMs(x.responseMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
