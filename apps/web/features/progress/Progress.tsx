"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart } from "@/components/charts";
import { Button, Card, Notice, SectionTitle, Stat } from "@/components/ui";
import { MIN_EVIDENCE, READINESS, readiness, skillStates } from "@/lib/analytics";
import { api } from "@/lib/api";
import { db } from "@/lib/db";
import { clearSamples, loadSamples, recentErrors } from "@/lib/perf";
import { fmtMs, fmtPct, median, percentile } from "@/lib/stats";
import { drain } from "@/lib/sync";
import { useLocalData } from "@/lib/useLocal";
import { useAuth } from "@/stores/app";
import { SkillBars } from "@/features/dashboard/Dashboard";
import { LESSON_INDEX } from "@/features/lessons/meta";

const DAY = 86_400_000;

export function Progress() {
  const { sessions, games, lessons, loading } = useLocalData();
  const [trainer, setTrainer] = useState<string>("");
  const user = useAuth((s) => s.user);

  const trainers = useMemo(() => [...new Set((sessions ?? []).filter((s) => s.attempts.length).map((s) => s.trainer))], [sessions]);
  const skills = useMemo(() => (sessions && games ? skillStates(sessions, games) : []), [sessions, games]);

  const history = useMemo(() => {
    const ss = (sessions ?? []).filter((s) => s.attempts.some((a) => a.correct !== null) && (!trainer || s.trainer === trainer)).sort((a, b) => a.startedAt - b.startedAt);
    return ss.map((s, i) => {
      const g = s.attempts.filter((a) => a.correct !== null);
      return { i, at: s.startedAt, acc: g.filter((a) => a.correct).length / g.length, med: median(g.map((a) => a.responseMs)) ?? 0, qpm: s.durationMs ? s.attempts.length / (s.durationMs / 60000) : 0 };
    });
  }, [sessions, trainer]);

  const plan = useMemo(() => {
    const now = Date.now();
    const due = skills.filter((s) => s.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt).slice(0, 3).map((s) => `Review ${s.tag.replace(/_/g, " ")} (due ${s.dueAt < now - DAY ? "overdue" : "today"}, mastery ${Math.round(s.mastery * 100)})`);
    const weak = skills.filter((s) => s.attempts >= 10).sort((a, b) => a.ewma - b.ewma).slice(0, 2).map((s) => `Strengthen ${s.tag.replace(/_/g, " ")} (recent accuracy ${Math.round(s.ewma * 100)}%)`);
    const lesson = (lessons ?? []).find((l) => l.status !== "completed" && LESSON_INDEX[l.id]);
    const items = [...due, ...weak];
    if (lesson) items.push(`Finish lesson: ${LESSON_INDEX[lesson.id]!.title}`);
    if (!items.length) items.push("Speed Arithmetic, 2 × 60s sprints", "One probability set in practice mode", "One market-making game");
    return [...new Set(items)].slice(0, 6);
  }, [skills, lessons]);

  return (
    <div className="space-y-2">
      {loading ? <p className="text-muted">Loading…</p> : (
        <>
          <SectionTitle>Daily training plan</SectionTitle>
          <Card><ol className="list-decimal pl-5 text-sm space-y-1" data-testid="daily-plan">{plan.map((p) => <li key={p}>{p}</li>)}</ol>
            <p className="text-xs text-muted mt-2">Built from spaced-repetition due dates (SM-2 style intervals per skill), weakest recent accuracy, and unfinished lessons.</p></Card>

          <SectionTitle aside={<select value={trainer} onChange={(e) => setTrainer(e.target.value)} className="rounded border border-border bg-bg px-2 py-1 text-xs" aria-label="Filter by trainer"><option value="">All trainers</option>{trainers.map((t) => <option key={t} value={t}>{t}</option>)}</select>}>Improvement over time</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><LineChart ariaLabel="Accuracy by session" yDomain={[0, 1]} series={[{ label: "accuracy", color: "#00F5D4", points: history.map((h) => ({ x: h.i + 1, y: h.acc })) }]} xLabel="session #" yLabel="accuracy" /></Card>
            <Card><LineChart ariaLabel="Median response time by session" series={[{ label: "median RT (ms)", color: "#00E5FF", points: history.map((h) => ({ x: h.i + 1, y: h.med })) }]} xLabel="session #" yLabel="ms" /></Card>
          </div>

          <SectionTitle>Skill mastery & review schedule</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><SkillBars skills={skills} /></Card>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="skills-table">
                <thead className="text-xs text-muted text-left"><tr><th>Skill</th><th>n</th><th>Acc.</th><th>Median RT</th><th>Next review</th></tr></thead>
                <tbody className="font-mono num">{skills.map((s) => <tr key={s.tag} className="border-t border-border"><td className="font-sans py-1">{s.tag.replace(/_/g, " ")}</td><td>{Math.round(s.attempts)}</td><td>{fmtPct(s.correct / s.attempts)}</td><td>{fmtMs(s.medianMs)}</td><td className={s.dueAt <= Date.now() ? "text-cyan" : "text-muted"}>{s.dueAt <= Date.now() ? "due" : new Date(s.dueAt).toLocaleDateString()}</td></tr>)}</tbody>
              </table>
            </Card>
          </div>

          <SectionTitle>Readiness — method</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            {(Object.keys(READINESS) as (keyof typeof READINESS)[]).map((role) => {
              const r = readiness(role, skills);
              return (
                <Card key={role}>
                  <div className="flex justify-between"><h3 className="font-medium capitalize">{role}</h3><span className="font-mono text-cyan">{r.score == null ? "—" : Math.round(r.score * 100)}</span></div>
                  <table className="mt-2 w-full text-xs"><tbody>{r.components.map((c) => <tr key={c.skill} className="border-t border-border"><td className="py-0.5">{c.label}</td><td className="text-muted">w={c.weight}</td><td className="text-right font-mono">{c.measured ? Math.round((c.mastery as number) * 100) : <span className="text-muted">n={Math.round(c.evidence)}/{MIN_EVIDENCE}</span>}</td></tr>)}</tbody></table>
                  <p className="text-xs text-muted mt-1">coverage {Math.round(r.coverage * 100)}%</p>
                </Card>
              );
            })}
          </div>
          <Notice>Mastery = EWMA of per-session accuracy (α = 0.3) × n/(n+20). Readiness = Σ wᵢ·masteryᵢ / Σ wᵢ over skills with ≥ {MIN_EVIDENCE} observations; coverage is the measured share of weights. Game scores (0–100) count as 10 observations at score/100.</Notice>

          <SectionTitle>Games</SectionTitle>
          <Card className="overflow-x-auto">
            {(games ?? []).length === 0 ? <p className="text-sm text-muted">No games yet.</p> : (
              <table className="w-full text-sm"><thead className="text-xs text-muted text-left"><tr><th>Game</th><th>Played</th><th>Best</th><th>Median</th><th>Last</th></tr></thead>
                <tbody className="font-mono num">{[...new Set((games ?? []).map((g) => g.gameType))].map((t) => { const gs = (games ?? []).filter((g) => g.gameType === t && g.score != null); const sc = gs.map((g) => g.score as number); return <tr key={t} className="border-t border-border"><td className="font-sans py-1">{t.replace(/_/g, " ")}</td><td>{gs.length}</td><td>{sc.length ? Math.max(...sc).toFixed(1) : "—"}</td><td>{median(sc)?.toFixed(1) ?? "—"}</td><td>{sc[0]?.toFixed(1) ?? "—"}</td></tr>; })}</tbody></table>
            )}
          </Card>

          <ServerAnalytics signedIn={!!user} />
          <PerfDiagnostics />
          <SyncStatus />
        </>
      )}
    </div>
  );
}

function ServerAnalytics({ signedIn }: { signedIn: boolean }) {
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => api<{ sessions: number; attempts: number; correct: number; accuracy: number | null; games_completed: number }>("/progress/summary"), enabled: signedIn });
  const bench = useQuery({ queryKey: ["bench", "speed80"], queryFn: () => api<{ status: string; sample_size: number; message?: string; your_percentile?: number | null; your_best_score?: number | null }>("/analytics/benchmarks?trainer_type=mixed&difficulty=6&config_key=speed80"), enabled: signedIn });
  return (
    <>
      <SectionTitle>Account (server)</SectionTitle>
      <Card>
        {!signedIn ? <p className="text-sm text-muted"><Link href="/account" className="text-cyan">Sign in</Link> to sync history across devices and compare server-validated assessments against cohorts.</p> : summary.isLoading ? <p className="text-sm text-muted">Loading…</p> : summary.data ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Synced sessions" value={summary.data.sessions} /><Stat label="Synced attempts" value={summary.data.attempts} />
              <Stat label="Accuracy" value={fmtPct(summary.data.accuracy, 1)} /><Stat label="Games" value={summary.data.games_completed} />
            </div>
            {bench.data && <p className="text-sm">80-in-8 cohort (server-validated, best per user, 90 days): {bench.data.status === "insufficient_data" ? <span className="text-muted">{bench.data.message}</span> : <>your percentile <span className="font-mono text-cyan">{bench.data.your_percentile?.toFixed(0) ?? "—"}</span> of n={bench.data.sample_size}{bench.data.status === "provisional" ? " (provisional)" : ""}</>}</p>}
          </div>
        ) : <p className="text-sm text-error">Server analytics unavailable.</p>}
      </Card>
    </>
  );
}

function PerfDiagnostics() {
  const [s, setS] = useState<ReturnType<typeof loadSamples> | null>(null);
  useEffect(() => setS(loadSamples()), []);
  if (!s) return null;
  const row = (label: string, xs: number[], target: string) => (
    <tr className="border-t border-border"><td className="py-1 font-sans">{label}</td><td>{xs.length}</td><td>{fmtMs(percentile(xs, 0.5), 2)}</td><td>{fmtMs(percentile(xs, 0.95), 2)}</td><td>{fmtMs(percentile(xs, 0.99), 2)}</td><td className="text-muted font-sans">{target}</td></tr>
  );
  return (
    <>
      <SectionTitle aside={<Button variant="ghost" onClick={() => { clearSamples(); setS({ ...loadSamples() }); }}>Clear</Button>}>Performance diagnostics (measured on this device)</SectionTitle>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="perf-table"><thead className="text-xs text-muted text-left"><tr><th>Metric</th><th>Samples</th><th>p50</th><th>p95</th><th>p99</th><th>Engineering target</th></tr></thead>
          <tbody className="font-mono num">
            {row("Answer processing (JS)", s.processing, "p95 < 5 ms")}
            {row("Input → next-question paint", s.inputToPaint, "p95 < 50 ms")}
            {row("Event Timing duration (INP proxy)", s.eventTiming, "< 200 ms (good INP)")}
          </tbody></table>
        <p className="text-xs text-muted mt-2">Values come from performance.now() instrumentation in the trainer and the browser Event Timing API (where supported). Targets are goals, not guarantees. {recentErrors().length ? `${recentErrors().length} client errors captured this session.` : "No client errors captured this session."}</p>
      </Card>
    </>
  );
}

function SyncStatus() {
  const [n, setN] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const refresh = () => void db.outboxAll().then((o) => setN(o.length));
  useEffect(refresh, []);
  return (
    <>
      <SectionTitle>Sync queue</SectionTitle>
      <Card className="flex flex-wrap items-center gap-3 text-sm">
        <span>{n == null ? "…" : `${n} item(s) waiting to sync`}</span>
        <Button variant="ghost" onClick={async () => { const r = await drain(); setMsg(`sent ${r.sent}, failed ${r.failed}`); refresh(); }}>Sync now</Button>
        <span className="text-muted">{msg}</span>
      </Card>
    </>
  );
}
