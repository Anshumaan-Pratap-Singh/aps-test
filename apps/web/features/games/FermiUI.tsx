"use client";

import { useRef, useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { randomSeed, Rng, uid } from "@/lib/rng";
import { enqueueGame } from "@/lib/sync";
import { FERMI, fermiScore, parseMagnitude, type FermiItem } from "./fermi";
import { MetricGrid } from "./GameShell";

const ROUNDS = 6;
const fmtNum = (x: number) => (x >= 1e4 || x < 1e-2 ? x.toExponential(2) : x.toLocaleString(undefined, { maximumFractionDigits: 2 }));

interface Result { item: FermiItem; point: number; lo: number; hi: number; conf: number; secs: number; s: ReturnType<typeof fermiScore> }

export function FermiUI() {
  const [game, setGame] = useState<{ id: string; seed: number; items: FermiItem[]; startedAt: number } | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [form, setForm] = useState({ point: "", lo: "", hi: "", conf: "0.8" });
  const [err, setErr] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Result | null>(null);
  const t0 = useRef(0);

  const start = () => {
    const seed = randomSeed();
    const items = new Rng(`fermi:${seed}`).shuffle([...FERMI]).slice(0, ROUNDS);
    setGame({ id: uid(), seed, items, startedAt: Date.now() }); setI(0); setResults([]); setReveal(null);
    t0.current = performance.now();
  };

  if (!game) return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Fermi Estimation</h2>
      <p className="text-sm text-muted">Six questions. For each, give a point estimate and an interval you believe contains the truth with your chosen confidence. Inputs accept <code>3e6</code>, <code>3,000,000</code>, <code>3.2 million</code>, <code>40k</code>, <code>1.5bn</code>.</p>
      <p className="text-sm text-muted">Scored with the <strong>interval score</strong> on log₁₀ values — a proper scoring rule: interval width costs you directly, and missing the truth costs (2/α)× the distance in orders of magnitude. Reporting your honest quantiles maximises expected score; making intervals wider than you believe does not.</p>
      <Button onClick={start} data-testid="start-game">Start</Button>
    </Card>
  );

  const finished = results.length === ROUNDS && !reveal;
  if (finished) {
    const score = results.reduce((a, r) => a + r.s.composite, 0) / results.length;
    const coverage = results.filter((r) => r.s.covered).length / results.length;
    return (
      <Card className="space-y-4" data-testid="game-results">
        <div className="flex justify-between"><h2 className="text-lg font-semibold">Fermi round complete</h2><span className="font-mono text-2xl text-teal" data-testid="game-score">{score.toFixed(1)}</span></div>
        <MetricGrid items={[
          { label: "Coverage", value: `${Math.round(coverage * 100)}%`, sub: `target ≈ ${Math.round((results.reduce((a, r) => a + r.conf, 0) / results.length) * 100)}% (your confidence)` },
          { label: "Median |log error|", value: [...results].map((r) => r.s.pointLog10Error).sort((a, b) => a - b)[Math.floor(results.length / 2)]!.toFixed(2), sub: "orders of magnitude" },
          { label: "Avg width", value: (results.reduce((a, r) => a + r.s.widthOrders, 0) / results.length).toFixed(2), sub: "orders of magnitude" },
          { label: "Avg interval score", value: (results.reduce((a, r) => a + r.s.intervalScoreLog10, 0) / results.length).toFixed(2), sub: "lower is better" },
        ]} />
        <p className="text-sm text-muted">Calibration check: if your coverage is far below your stated confidence you are overconfident; far above with wide intervals, underconfident.</p>
        <Button onClick={start} data-testid="play-again">Play again</Button>
      </Card>
    );
  }

  if (reveal) {
    return (
      <Card className="space-y-3" data-testid="fermi-reveal">
        <h2 className="font-semibold">{reveal.item.question}</h2>
        <p>Reference value: <span className="font-mono text-cyan">{fmtNum(reveal.item.truth)}</span> {reveal.item.unit}</p>
        <p className="text-sm">Your estimate {fmtNum(reveal.point)} in [{fmtNum(reveal.lo)}, {fmtNum(reveal.hi)}] at {Math.round(reveal.conf * 100)}% — {reveal.s.covered ? <span className="text-teal">covered</span> : <span className="text-error">missed</span>} · log error {reveal.s.pointLog10Error.toFixed(2)} · interval score {reveal.s.intervalScoreLog10.toFixed(2)} · round score <span className="font-mono text-teal">{reveal.s.composite.toFixed(1)}</span></p>
        <div className="text-sm text-muted"><div className="text-xs uppercase tracking-wider text-blue">Estimation chain</div><ul className="list-disc pl-5">{reveal.item.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></div>
        <Button onClick={async () => {
          setReveal(null);
          if (results.length === ROUNDS) {
            const score = results.reduce((a, r) => a + r.s.composite, 0) / results.length;
            const g = { id: game.id, gameType: "fermi", category: "market" as const, difficulty: 5, seed: game.seed, startedAt: game.startedAt, endedAt: Date.now(), score,
              metrics: { coverage: results.filter((r) => r.s.covered).length / results.length, meanIntervalScore: results.reduce((a, r) => a + r.s.intervalScoreLog10, 0) / results.length },
              events: results.map((r, k) => ({ seq: k, type: "estimate", payload: { id: r.item.id, point: r.point, lo: r.lo, hi: r.hi, conf: r.conf, secs: r.secs }, t: r.secs })),
              initialState: { seed: game.seed, items: game.items.map((x) => x.id) }, finalState: {}, synced: false };
            await db.saveGame(g); void enqueueGame(g);
          } else { setI(i + 1); t0.current = performance.now(); }
        }} data-testid="fermi-next">{results.length === ROUNDS ? "See results" : "Next question"}</Button>
      </Card>
    );
  }

  const item = game.items[i]!;
  const submit = () => {
    const point = parseMagnitude(form.point), lo = parseMagnitude(form.lo), hi = parseMagnitude(form.hi), conf = Number(form.conf);
    if (!point || !lo || !hi) return setErr("Enter positive numbers (e.g. 3e6, 40k, 2.5 million).");
    if (!(lo <= point && point <= hi)) return setErr("Need lower ≤ point ≤ upper.");
    setErr(null);
    const secs = (performance.now() - t0.current) / 1000;
    const r: Result = { item, point, lo, hi, conf, secs, s: fermiScore(point, lo, hi, item.truth, conf, secs) };
    setResults([...results, r]); setReveal(r); setForm({ point: "", lo: "", hi: "", conf: form.conf });
  };
  return (
    <Card className="space-y-4" data-testid="fermi-game">
      <div className="text-xs text-muted">Question {i + 1}/{ROUNDS} · {item.category}</div>
      <h2 className="text-xl font-semibold">{item.question} <span className="text-muted text-base">({item.unit})</span></h2>
      <form className="grid gap-3 sm:grid-cols-4 items-end" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {(["lo", "point", "hi"] as const).map((k) => (
          <label key={k} className="text-xs text-muted">{k === "lo" ? "Lower bound" : k === "hi" ? "Upper bound" : "Point estimate"}
            <input data-testid={`fermi-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 block w-full rounded-md border border-border bg-bg px-3 py-2 font-mono focus:border-cyan focus:outline-none" /></label>
        ))}
        <label className="text-xs text-muted">Confidence
          <select value={form.conf} onChange={(e) => setForm({ ...form, conf: e.target.value })} className="mt-1 block w-full rounded-md border border-border bg-bg px-3 py-2"><option value="0.5">50%</option><option value="0.8">80%</option><option value="0.9">90%</option></select></label>
        <Button type="submit" data-testid="fermi-submit">Submit estimate</Button>
      </form>
      {err && <p className="text-sm text-error">{err}</p>}
      <Notice>Speed counts a little (score × 0.8–1.0 over 60 s). Accuracy and calibration count much more.</Notice>
    </Card>
  );
}
