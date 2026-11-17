"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BarChart } from "@/components/charts";
import { Card, Notice, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { readiness, skillStates, streakDays, type SkillState } from "@/lib/analytics";
import { fmtMs, fmtPct, median } from "@/lib/stats";
import { useLocalData } from "@/lib/useLocal";
import { usePrefs } from "@/stores/app";
import { LESSON_INDEX } from "@/features/lessons/meta";

const SKILL_ROUTES: Record<string, string> = {
  arithmetic: "/mental-math/train?type=mixed", multiplication: "/mental-math/train?type=multiplication", percentages: "/mental-math/train?type=percent_of",
  missing_operand: "/mental-math/train?type=missing_operand", decimals: "/mental-math/train?type=decimal_mult", fractions: "/mental-math/fractions",
  sequences: "/mental-math/sequences", probability: "/probability/train", expected_value: "/probability/train", bayes: "/market-games/event-contracts",
  market_making: "/market-games/market-making", inventory_management: "/market-games/market-making", etf: "/market-games/etf-arbitrage",
  estimation: "/market-games/fermi", cognitive_flexibility: "/cognitive/task-switch", inhibition: "/cognitive/response-conflict",
  working_memory: "/cognitive/pincode", stochastic_processes: "/probability/train", combinatorics: "/probability/problems",
};

export function Dashboard() {
  const { sessions, games, lessons, loading } = useLocalData();
  const { levels, baselineDone } = usePrefs();

  const d = useMemo(() => {
    if (!sessions || !games) return null;
    const attempts = sessions.flatMap((s) => s.attempts.filter((a) => a.correct !== null));
    const correct = attempts.filter((a) => a.correct).length;
    const timeMs = sessions.reduce((a, s) => a + s.durationMs, 0) + games.reduce((a, g) => a + ((g.endedAt ?? g.startedAt) - g.startedAt), 0);
    const stamps = [...sessions.filter((s) => s.attempts.length).map((s) => s.startedAt), ...games.filter((g) => g.endedAt).map((g) => g.startedAt)];
    const skills = skillStates(sessions, games);
    // weekly: questions per day for the last 7 days
    const days = Array.from({ length: 7 }, (_, i) => { const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - (6 - i)); return dt; });
    const weekly = days.map((dt) => {
      const next = dt.getTime() + 86_400_000;
      const att = sessions.filter((s) => s.startedAt >= dt.getTime() && s.startedAt < next).flatMap((s) => s.attempts);
      return { label: dt.toLocaleDateString(undefined, { weekday: "short" }), value: att.length, acc: att.length ? att.filter((a) => a.correct).length / att.length : null };
    });
    // improvements/regressions: last 7d vs previous 7d, per trainer, accuracy & median RT
    const now = Date.now(), W = 7 * 86_400_000;
    const trainers = [...new Set(sessions.map((s) => s.trainer))];
    const deltas = trainers.map((t) => {
      const win = (lo: number, hi: number) => sessions.filter((s) => s.trainer === t && s.startedAt >= lo && s.startedAt < hi).flatMap((s) => s.attempts.filter((a) => a.correct !== null));
      const cur = win(now - W, now), prev = win(now - 2 * W, now - W);
      if (cur.length < 10 || prev.length < 10) return null;
      const acc = (x: typeof cur) => x.filter((a) => a.correct).length / x.length;
      return { trainer: t, dAcc: acc(cur) - acc(prev), dMed: (median(cur.map((a) => a.responseMs)) ?? 0) - (median(prev.map((a) => a.responseMs)) ?? 0) };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    const bests = trainers.map((t) => {
      const ss = sessions.filter((s) => s.trainer === t && s.attempts.length >= 5);
      const best = ss.reduce<{ net: number; acc: number } | null>((b, s) => {
        const c = s.attempts.filter((a) => a.correct).length, net = c - (s.attempts.length - c);
        return !b || net > b.net ? { net, acc: c / s.attempts.length } : b;
      }, null);
      return best ? { trainer: t, ...best } : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null).sort((a, b) => b.net - a.net).slice(0, 6);
    return {
      attempts: attempts.length, accuracy: attempts.length ? correct / attempts.length : null, meanMs: attempts.length ? attempts.reduce((a, b) => a + b.responseMs, 0) / attempts.length : null,
      timeMs, streak: streakDays(stamps), skills, weekly, deltas, bests,
      readiness: { trader: readiness("trader", skills), researcher: readiness("researcher", skills), developer: readiness("developer", skills) },
    };
  }, [sessions, games]);

  const recommendations = useMemo(() => d ? recommend(d.skills) : [], [d]);
  const incompleteLessons = (lessons ?? []).filter((l) => l.status !== "completed");

  return (
    <>
      <PageHeader title="Training Command Centre" kicker="Dashboard">
        Everything below is computed from your stored attempts on this device{" "}
        <span className="text-text">(synced to your account when signed in)</span>. No figure is estimated without data.
      </PageHeader>
      {!baselineDone && (
        <Card className="mb-6 border-cyan/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-cyan">Take the baseline assessment</h2>
              <p className="text-sm text-muted">About five minutes across arithmetic, sequences and fractions to set your starting difficulty levels.</p>
            </div>
            <Link href="/assessments/baseline" className="rounded-md bg-cyan text-bg px-4 py-2 text-sm font-semibold hover:bg-teal">Start baseline</Link>
          </div>
        </Card>
      )}
      {loading || !d ? <p className="text-muted">Loading local history…</p> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" data-testid="dashboard-stats">
            <Stat label="Daily streak" value={`${d.streak}d`} tone="accent" />
            <Stat label="Training time" value={`${Math.round(d.timeMs / 60000)}m`} />
            <Stat label="Questions" value={d.attempts} />
            <Stat label="Accuracy" value={fmtPct(d.accuracy, 1)} tone="good" />
            <Stat label="Avg response" value={fmtMs(d.meanMs)} />
            <Stat label="Games played" value={(games ?? []).filter((g) => g.endedAt).length} />
          </div>

          <SectionTitle aside={<Link href="/progress" className="text-xs text-blue hover:text-cyan">Method →</Link>}>Readiness overview</SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            {(["trader", "researcher", "developer"] as const).map((role) => {
              const r = d.readiness[role];
              return (
                <Card key={role}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-medium capitalize">Quant {role}</h3>
                    <span className="font-mono num text-2xl text-cyan">{r.score == null ? "—" : Math.round(r.score * 100)}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded bg-border overflow-hidden"><div className="h-full bg-teal" style={{ width: `${r.coverage * 100}%` }} /></div>
                  <p className="mt-1 text-xs text-muted">{r.score == null ? "Insufficient evidence — " : ""}{Math.round(r.coverage * 100)}% of the role profile measured (≥20 observations per skill).</p>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mt-2">
            <div>
              <SectionTitle>This week · questions per day</SectionTitle>
              <Card><BarChart ariaLabel="Questions answered per day this week" bars={d.weekly.map((w) => ({ label: w.label, value: w.value, color: "#00E5FF" }))} /></Card>
            </div>
            <div>
              <SectionTitle>Recommended next</SectionTitle>
              <Card>
                {recommendations.length === 0 ? <p className="text-sm text-muted">Complete a few sessions to get recommendations. Start with <Link className="text-cyan" href="/mental-math/train?type=mixed">Speed Arithmetic</Link>.</p> : (
                  <ul className="space-y-2">
                    {recommendations.map((r) => (
                      <li key={r.tag} className="flex items-center justify-between gap-2 text-sm">
                        <span><span className="text-text">{r.tag.replace(/_/g, " ")}</span> <span className="text-muted">— {r.reason}</span></span>
                        {SKILL_ROUTES[r.tag] && <Link href={SKILL_ROUTES[r.tag]!} className="text-cyan text-xs shrink-0">Train →</Link>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 mt-2">
            <div>
              <SectionTitle>Skill mastery</SectionTitle>
              <Card><SkillBars skills={d.skills} /></Card>
            </div>
            <div>
              <SectionTitle>Personal bests</SectionTitle>
              <Card>
                {d.bests.length === 0 ? <p className="text-sm text-muted">No sessions yet.</p> : (
                  <table className="w-full text-sm"><tbody>
                    {d.bests.map((b) => <tr key={b.trainer} className="border-t border-border first:border-0"><td className="py-1">{b.trainer.replace(/_/g, " ")}</td><td className="text-right font-mono num text-teal">{b.net}</td><td className="text-right font-mono num text-muted">{fmtPct(b.acc)}</td></tr>)}
                  </tbody></table>
                )}
                <p className="text-xs text-muted mt-2">Best net score (correct − incorrect) per trainer.</p>
              </Card>
            </div>
            <div>
              <SectionTitle>Changes vs previous week</SectionTitle>
              <Card>
                {d.deltas.length === 0 ? <p className="text-sm text-muted">Needs ≥10 attempts in each of the last two weeks for a trainer.</p> : (
                  <ul className="space-y-1 text-sm">
                    {d.deltas.map((x) => (
                      <li key={x.trainer} className="flex justify-between"><span>{x.trainer.replace(/_/g, " ")}</span>
                        <span className="font-mono num"><span className={x.dAcc >= 0 ? "text-teal" : "text-error"}>{x.dAcc >= 0 ? "+" : ""}{(x.dAcc * 100).toFixed(1)}pp</span>{" "}
                          <span className={x.dMed <= 0 ? "text-teal" : "text-error"}>{x.dMed <= 0 ? "" : "+"}{Math.round(x.dMed)}ms</span></span></li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mt-2">
            <div>
              <SectionTitle>Current difficulty levels</SectionTitle>
              <Card>
                {Object.keys(levels).length === 0 ? <p className="text-sm text-muted">Defaults to level 3 until the baseline or adaptive rules set a level.</p> : (
                  <div className="flex flex-wrap gap-2">{Object.entries(levels).map(([k, v]) => <span key={k} className="rounded border border-border px-2 py-1 text-xs">{k.replace(/_/g, " ")} <span className="font-mono text-cyan">L{v}</span></span>)}</div>
                )}
              </Card>
              <SectionTitle>Incomplete lessons</SectionTitle>
              <Card>
                {incompleteLessons.length === 0 ? <p className="text-sm text-muted">None in progress. <Link className="text-cyan" href="/learn">Browse the academy →</Link></p> : (
                  <ul className="text-sm space-y-1">{incompleteLessons.map((l) => <li key={l.id}><Link className="text-cyan" href={`/learn/${l.id.replace("lesson:", "")}`}>{LESSON_INDEX[l.id]?.title ?? l.id}</Link></li>)}</ul>
                )}
              </Card>
            </div>
            <div>
              <SectionTitle>Recent sessions</SectionTitle>
              <Card>
                {(sessions ?? []).length === 0 && (games ?? []).length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
                  <table className="w-full text-sm" data-testid="recent-sessions">
                    <tbody>
                      {[...(sessions ?? []).slice(0, 8).map((s) => ({ id: s.id, at: s.startedAt, what: s.trainer, detail: s.attempts.some((a) => a.correct === null) ? (s.serverResult ? `${s.serverResult.correct}/${s.serverResult.total} (server)` : "awaiting grading") : `${s.attempts.filter((a) => a.correct).length}/${s.attempts.length}`, synced: s.synced })),
                        ...(games ?? []).slice(0, 5).map((g) => ({ id: g.id, at: g.startedAt, what: g.gameType, detail: g.score == null ? "—" : `score ${g.score.toFixed(1)}`, synced: g.synced }))]
                        .sort((a, b) => b.at - a.at).slice(0, 10).map((r) => (
                          <tr key={r.id} className="border-t border-border first:border-0">
                            <td className="py-1 text-muted text-xs">{new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                            <td>{r.what.replace(/_/g, " ")}</td>
                            <td className="text-right font-mono num">{r.detail}</td>
                            <td className="text-right text-xs" title={r.synced ? "Synced" : "Local only"}>{r.synced ? "☁" : "·"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </div>
          <div className="mt-6"><Notice>Readiness is a weighted mean of measured skill mastery, reported with its coverage. It is a training signal, not a prediction of any firm's hiring decision.</Notice></div>
        </>
      )}
    </>
  );
}

function recommend(skills: SkillState[]) {
  const now = Date.now();
  const due = skills.filter((s) => s.dueAt <= now).sort((a, b) => a.mastery - b.mastery).map((s) => ({ tag: s.tag, reason: `review due (mastery ${Math.round(s.mastery * 100)})` }));
  const weak = skills.filter((s) => s.attempts >= 10 && s.ewma < 0.75).sort((a, b) => a.ewma - b.ewma).map((s) => ({ tag: s.tag, reason: `accuracy trending ${Math.round(s.ewma * 100)}%` }));
  const seen = new Set<string>();
  return [...due, ...weak].filter((r) => (seen.has(r.tag) ? false : (seen.add(r.tag), true))).slice(0, 6);
}

export function SkillBars({ skills }: { skills: SkillState[] }) {
  if (!skills.length) return <p className="text-sm text-muted">No skill observations yet.</p>;
  return (
    <ul className="space-y-1.5">
      {skills.slice().sort((a, b) => b.attempts - a.attempts).slice(0, 12).map((s) => (
        <li key={s.tag} className="text-xs">
          <div className="flex justify-between"><span>{s.tag.replace(/_/g, " ")}</span><span className="font-mono num text-muted">{Math.round(s.mastery * 100)} · n={Math.round(s.attempts)}</span></div>
          <div className="h-1 rounded bg-border overflow-hidden"><div className="h-full bg-cyan" style={{ width: `${s.mastery * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
