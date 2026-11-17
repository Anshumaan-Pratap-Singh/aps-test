"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Notice, Stat } from "@/components/ui";
import { api, ApiError, AssessmentStartSchema } from "@/lib/api";
import { db, type LocalSession } from "@/lib/db";
import { randomSeed } from "@/lib/rng";
import { fmtPct } from "@/lib/stats";
import { syncSession } from "@/lib/sync";
import type { DisplayQuestion } from "@/features/trainer/engine";
import { localSource, serverToDisplay } from "@/features/trainer/local";
import { TrainerConsole } from "@/features/trainer/TrainerConsole";
import { useAuth } from "@/stores/app";
import { PRESETS, type Preset } from "./presets";

interface Benchmark { status: string; sample_size: number; min_cohort_size: number; message?: string; your_percentile?: number | null; quantiles?: Record<string, number | null>; your_best_score?: number | null }

export function AssessmentRunner({ presetKey }: { presetKey: string }) {
  const preset = PRESETS.find((p) => p.key === presetKey) as Preset;
  const { user, status } = useAuth();
  const [run, setRun] = useState<null | { mode: "server" | "local"; seed: number; sessionId?: string; source: (i: number) => DisplayQuestion }>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startServer = async () => {
    setLoading(true); setError(null);
    try {
      const r = await api("/sessions/assessment", { method: "POST", json: { trainer_type: preset.trainer, difficulty: preset.difficulty, question_count: preset.questions, duration_limit_s: preset.seconds, config_key: preset.key } }, AssessmentStartSchema);
      const qs = r.questions.map(serverToDisplay);
      setRun({ mode: "server", seed: r.session.seed, sessionId: r.client_session_id, source: (i) => qs[i]! });
    } catch (e) {
      setError(e instanceof ApiError ? `Could not start a server-validated assessment (${e.status}: ${e.message}).` : "Server unreachable.");
    } finally { setLoading(false); }
  };

  const startLocal = () => {
    const seed = randomSeed();
    const src = localSource(preset.trainer, seed, preset.difficulty);
    // Hide answers during the run: grading happens at the end from the stored expected answers.
    setRun({ mode: "local", seed, source: (i) => src(i) });
  };

  const meta = useMemo(() => run ? ({ trainer: preset.trainer, category: "assessment" as const, mode: (run.mode === "server" ? "assessment" : "timed") as LocalSession["mode"], configKey: preset.key,
    difficulty: preset.difficulty, seed: run.seed, sessionId: run.sessionId }) : null, [run, preset]);

  if (run && meta) {
    return (
      <TrainerConsole key={run.seed} meta={meta} questionAt={run.source} questionLimit={preset.questions} durationMs={preset.seconds * 1000}
        showFeedback={false} autoStart onExit={() => setRun(null)}
        resultsExtra={(s) => run.mode === "server" ? <ServerResult session={s} preset={preset} /> : <Notice>Local, unofficial run — graded on this device and not eligible for benchmarks. Sign in for a server-validated attempt.</Notice>} />
    );
  }

  const signedIn = !!user;
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">{preset.title}</h2>
      <p className="text-sm text-muted">{preset.description} Difficulty level {preset.difficulty}. No feedback, hints or solutions until the end.</p>
      <ul className="text-sm text-muted list-disc pl-5">
        <li><strong className="text-text">Server-validated</strong>: questions come from the server without answers; the server regenerates each question from its seed and grades your answers. Eligible for cohort benchmarks.</li>
        <li><strong className="text-text">Local practice</strong>: generated and graded on-device; works offline; not benchmarked.</li>
      </ul>
      {error && <Notice tone="warn">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={startServer} disabled={!signedIn || loading} data-testid="start-server-assessment">{loading ? "Requesting questions…" : "Start server-validated"}</Button>
        {!preset.serverOnly && <Button variant="ghost" onClick={startLocal} data-testid="start-local-assessment">Start local practice run</Button>}
      </div>
      {!signedIn && <p className="text-xs text-muted">{status === "offline" ? "Backend unreachable." : <><Link href="/account" className="text-cyan">Sign in</Link> to take server-validated assessments.</>}{preset.serverOnly ? " This preset requires the server." : ""}</p>}
    </Card>
  );
}

function ServerResult({ session, preset }: { session: LocalSession; preset: Preset }) {
  const [state, setState] = useState<"syncing" | "done" | "error">("syncing");
  const [res, setRes] = useState<LocalSession["serverResult"] | null>(null);
  const [bench, setBench] = useState<Benchmark | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const go = useCallback(async () => {
    setState("syncing");
    try {
      const fresh = (await db.getSession(session.id)) ?? session;
      await syncSession(fresh);
      const after = await db.getSession(session.id);
      setRes(after?.serverResult ?? null);
      setState("done");
      const b = await api<Benchmark>(`/analytics/benchmarks?trainer_type=${preset.trainer}&difficulty=${preset.difficulty}&config_key=${preset.key}`);
      setBench(b);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); setState("error");
    }
  }, [session, preset]);

  useEffect(() => { void go(); }, [go]);

  if (state === "syncing") return <Notice>Submitting answers for server grading…</Notice>;
  if (state === "error") return <Card><p className="text-error text-sm">Could not reach the server: {err}. Your attempts are saved locally and will sync automatically.</p><Button variant="ghost" onClick={go}>Retry</Button></Card>;
  return (
    <Card className="space-y-3" data-testid="server-result">
      <h3 className="text-sm font-semibold">Server-validated result</h3>
      {res && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Correct" value={`${res.correct}/${preset.questions}`} tone="good" sub={`${res.total} answered`} />
        <Stat label="Accuracy" value={fmtPct(res.accuracy, 1)} /><Stat label="Net score" value={res.score ?? "—"} tone="accent" />
      </div>}
      {bench && (bench.status === "insufficient_data"
        ? <p className="text-sm text-muted">Percentile suppressed: {bench.message}</p>
        : <p className="text-sm">Percentile vs cohort (best score per user, last 90 days, n = {bench.sample_size}): <span className="font-mono text-cyan">{bench.your_percentile?.toFixed(0)}</span>{bench.status === "provisional" && <span className="text-muted"> — provisional (small cohort)</span>}</p>)}
    </Card>
  );
}
