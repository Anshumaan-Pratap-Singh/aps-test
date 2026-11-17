"use client";

import { useEffect, useState } from "react";
import { TexText } from "@/components/Math";
import { Button, Card, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { db } from "@/lib/db";
import { CodeEditor } from "./CodeEditor";
import type { Problem } from "./problems";
import { runPython, type RunResult } from "./runner";

const md = (s: string) => s.split(/(`[^`]+`)/g).map((p, i) => (p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code> : <TexText key={i}>{p}</TexText>));

export function Workspace({ problem }: { problem: Problem }) {
  const key = `code:${problem.id}`;
  const [code, setCode] = useState(problem.starter);
  const [lang, setLang] = useState<"python" | "cpp">("python");
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showEditorial, setShowEditorial] = useState(false);
  const [server, setServer] = useState<string | null>(null);

  useEffect(() => {
    try { const saved = localStorage.getItem(key); if (saved) setCode(saved); } catch { /* private mode */ }
    api<{ server_execution_enabled: boolean; message: string }>("/code/status").then((s) => setServer(s.message)).catch(() => setServer("Backend unreachable; local execution only."));
  }, [key]);
  useEffect(() => { try { localStorage.setItem(key, code); } catch { /* ignore */ } }, [key, code]);

  const run = async (includeHidden: boolean) => {
    setRunning(true); setResult(null);
    const tests = problem.tests.filter((t) => includeHidden || !t.hidden);
    const r = await runPython(code, tests, problem.timeLimitMs);
    setResult(r); setRunning(false);
    if (includeHidden && r.results.length === problem.tests.length) {
      const passed = r.results.filter((x) => x.passed).length;
      const id = `coding:${problem.id}`;
      const prev = (await db.allLessons()).find((l) => l.id === id);
      await db.saveLesson({ id, status: passed === problem.tests.length ? "completed" : "in_progress", checksCorrect: (prev?.checksCorrect ?? 0) + passed, checksTotal: (prev?.checksTotal ?? 0) + problem.tests.length, updatedAt: Date.now() });
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="space-y-3">
        <div className="text-sm leading-relaxed">{md(problem.statement)}</div>
        <div><div className="text-xs uppercase tracking-wider text-muted mb-1">Examples</div>{problem.examples.map((e) => <pre key={e} className="rounded bg-bg border border-border p-2 text-xs font-mono whitespace-pre-wrap">{e}</pre>)}</div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Public tests</div>
          {problem.tests.filter((t) => !t.hidden).map((t) => <details key={t.name} className="text-xs"><summary className="cursor-pointer">{t.name}</summary><pre className="rounded bg-bg border border-border p-2 font-mono whitespace-pre-wrap">{t.code}</pre></details>)}
          <p className="text-xs text-muted mt-1">+ {problem.tests.filter((t) => t.hidden).length} hidden tests (run on Submit). Time limit {problem.timeLimitMs} ms.</p>
        </div>
        <button className="text-xs text-blue hover:text-cyan underline" onClick={() => setShowEditorial(!showEditorial)}>{showEditorial ? "Hide" : "Show"} editorial</button>
        {showEditorial && <div className="text-sm text-muted">{md(problem.editorial)}</div>}
      </Card>
      <div className="space-y-3">
        <div className="flex gap-2" role="tablist">
          {(["python", "cpp"] as const).map((l) => <button key={l} role="tab" aria-selected={lang === l} onClick={() => setLang(l)} className={`rounded-md border px-3 py-1 text-sm ${lang === l ? "border-cyan text-cyan" : "border-border text-muted"}`}>{l === "python" ? "Python" : "C++"}</button>)}
        </div>
        {lang === "python" ? (
          <>
            <CodeEditor value={code} onChange={setCode} label={`${problem.title} solution (Python)`} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run(false)} disabled={running} data-testid="run-tests">{running ? "Running…" : "Run public tests"}</Button>
              <Button variant="ghost" onClick={() => run(true)} disabled={running} data-testid="submit-code">Submit (all tests)</Button>
              <Button variant="ghost" onClick={() => setCode(problem.starter)}>Reset</Button>
            </div>
          </>
        ) : (
          <>
            <pre className="rounded-md border border-border bg-[#08111f] p-3 font-mono text-[13px] overflow-x-auto">{problem.cppStarter}</pre>
            <Notice tone="warn">C++ compilation requires the isolated execution service, which is not enabled in this deployment. The interface is shown for reference; it cannot run.</Notice>
          </>
        )}
        {result && (
          <Card data-testid="run-results">
            {result.timedOut && <p className="text-error text-sm">{result.error}</p>}
            {result.compileError && <pre className="text-error text-xs whitespace-pre-wrap">{result.compileError}</pre>}
            {!result.ok && !result.timedOut && result.error && <pre className="text-error text-xs whitespace-pre-wrap">{result.error}</pre>}
            {result.results.length > 0 && (
              <>
                <p className="text-sm mb-2"><span className="font-mono text-teal" data-testid="tests-passed">{result.results.filter((r) => r.passed).length}</span>/{result.results.length} passed · {Math.round(result.wallMs)} ms wall</p>
                <ul className="text-sm space-y-1">{result.results.map((r) => <li key={r.name} className={r.passed ? "text-teal" : "text-error"}>{r.passed ? "✓" : "✗"} {r.hidden ? "[hidden] " : ""}{r.name} <span className="text-muted text-xs">{r.ms.toFixed(1)} ms</span>{r.error && <div className="text-xs text-muted pl-4">{r.error}</div>}</li>)}</ul>
              </>
            )}
            {result.stdout && <pre className="mt-2 text-xs text-muted whitespace-pre-wrap">{result.stdout}</pre>}
          </Card>
        )}
        <p className="text-xs text-muted">Python runs in WebAssembly inside a Web Worker in your browser, terminated on timeout. {server}</p>
      </div>
    </div>
  );
}
