"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TexText } from "@/components/Math";
import { db } from "@/lib/db";
import { parseNumber } from "@/lib/rational";

/**
 * Concept check: an exactly-graded question embedded in a lesson. Results are
 * recorded to lesson progress in IndexedDB (and feed skill mastery).
 */
export function Check({ lesson, id, prompt, answer, choices, explanation, tolerance = 0 }: {
  lesson: string; id: string; prompt: string; answer: string; choices?: string[]; explanation: string; tolerance?: number;
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<null | boolean>(null);

  const grade = (v: string) => {
    if (choices) return v === answer;
    const a = parseNumber(answer), x = parseNumber(v);
    if (!a || !x) return false;
    return tolerance ? Math.abs(x.toNumber() - a.toNumber()) <= Math.abs(a.toNumber()) * tolerance : x.eq(a);
  };

  const submit = async (v: string) => {
    if (result !== null || !v.trim()) return;
    const ok = grade(v.trim());
    setResult(ok);
    const prev = (await db.allLessons()).find((l) => l.id === lesson);
    const answered = new Set(prev?.answered ?? []);
    if (answered.has(id)) return;
    answered.add(id);
    await db.saveLesson({
      id: lesson, status: prev?.status === "completed" ? "completed" : "in_progress",
      checksCorrect: (prev?.checksCorrect ?? 0) + (ok ? 1 : 0), checksTotal: (prev?.checksTotal ?? 0) + 1, updatedAt: Date.now(),
      answered: [...answered],
    });
  };

  return (
    <div className="my-5 rounded-lg border border-blue/40 bg-blue/5 p-4" data-testid="concept-check">
      <div className="text-xs uppercase tracking-wider text-blue mb-1">Concept check</div>
      <div className="text-text"><TexText>{prompt}</TexText></div>
      {choices ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {choices.map((c) => (
            <button key={c} disabled={result !== null} onClick={() => { setValue(c); void submit(c); }}
              className={`rounded-md border px-3 py-1.5 text-sm ${value === c ? (result ? "border-teal text-teal" : "border-error text-error") : "border-border hover:border-cyan"}`}>
              <TexText>{c}</TexText>
            </button>
          ))}
        </div>
      ) : (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(value); }}>
          <input aria-label="Answer" value={value} onChange={(e) => setValue(e.target.value)} disabled={result !== null}
            className="w-40 rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-sm focus:border-cyan focus:outline-none" placeholder="exact answer" />
          <button type="submit" disabled={result !== null} className="rounded-md border border-border px-3 text-sm hover:border-cyan disabled:opacity-40">Check</button>
        </form>
      )}
      {result !== null && (
        <div className={`mt-3 text-sm ${result ? "text-teal" : "text-error"}`}>
          {result ? "Correct." : <>Not quite — answer: <span className="font-mono">{answer}</span>.</>}
          <div className="mt-1 text-muted"><TexText>{explanation}</TexText></div>
        </div>
      )}
    </div>
  );
}

export function CompleteLesson({ lesson }: { lesson: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => { void db.allLessons().then((ls) => setDone(ls.some((l) => l.id === lesson && l.status === "completed"))); }, [lesson]);
  const mark = async () => {
    const prev = (await db.allLessons()).find((l) => l.id === lesson);
    await db.saveLesson({ ...(prev ?? { checksCorrect: 0, checksTotal: 0 }), id: lesson, status: "completed", updatedAt: Date.now() });
    setDone(true);
  };
  return (
    <div className="mt-8 flex items-center gap-3">
      <button onClick={mark} disabled={done} data-testid="complete-lesson" className="rounded-md bg-cyan text-bg px-4 py-2 text-sm font-semibold disabled:opacity-50">
        {done ? "Completed ✓" : "Mark lesson complete"}
      </button>
    </div>
  );
}

export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="my-4 rounded-lg border-l-2 border-teal bg-elevated px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-teal mb-1">{title}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </aside>
  );
}

