"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { EventGame, explainEventQuote, summarizeEvents, type EvState } from "./events";
import { fmtCents } from "./framework";
import { GameSetup, MetricGrid, useGame } from "./GameShell";

export function EventsUI() {
  const g = useGame(EventGame);
  const [bid, setBid] = useState("");
  const [ask, setAsk] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const saved = useRef(false);
  const s = g.state;

  useEffect(() => {
    if (s?.over && !saved.current) {
      saved.current = true;
      const m = summarizeEvents(s);
      void g.save(m.score, { pnl: m.pnl / 100, mtmPnl: m.pnl / 100, edgeVsFair: m.edgeVsFair, quoteError: m.quoteError, outcome: s.outcome }, { outcome: s.outcome, inventory: s.ledger.qty });
    }
  }, [s, g]);

  if (!s) return (
    <GameSetup title="Event Contracts" defaultDifficulty={5} onStart={(d) => { saved.current = false; g.begin(d); }} rules={<>
      <p>A binary contract pays <strong>100</strong> if a synthetic event happens, 0 otherwise. You see the prior, then one news report per round with a stated reliability <em>r</em>: P(report says YES | event) = r and P(says YES | no event) = 1 − r.</p>
      <p>Update with log-odds: <code>logit(p′) = logit(p) ± ln(r/(1−r))</code>. Quote a bid and ask (integers 0–100). Informed traders know the outcome; noise traders trade around the true posterior. Widen when uncertain, skew against inventory.</p>
      <p>Scoring is on <em>decision quality</em> — edge versus the Bayesian fair price at each fill and quote accuracy — not on the coin flip at settlement.</p>
    </>} />
  );
  if (s.over) return <EventResults s={s} onAgain={() => { saved.current = false; g.begin(s.difficulty); }} />;

  const sig = s.signals[s.round]!;
  const submit = () => {
    const b = Number(bid), a = Number(ask);
    if (!Number.isInteger(b) || !Number.isInteger(a)) return setErr("Use whole numbers 0–100.");
    if (a <= b || b < 0 || a > 100) return setErr("Need 0 ≤ bid < ask ≤ 100.");
    setErr(null); g.dispatch({ type: "quote", bid: b, ask: a });
  };
  const last = s.history[s.history.length - 1];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]" data-testid="event-game">
      <Card>
        <p className="text-xs text-muted">Round {s.round + 1}/{s.rounds}</p>
        <h2 className="mt-1 text-lg font-semibold">“{s.title}”</h2>
        <p className="text-sm text-muted">Prior probability: <span className="font-mono text-text">{Math.round(s.prior * 100)}%</span></p>
        <ul className="mt-3 space-y-1 text-sm">
          {s.history.map((h) => <li key={h.index} className="text-muted">{h.signal.headline} → posterior <span className="font-mono text-cyan">{(h.posterior * 100).toFixed(1)}%</span></li>)}
          <li className="text-text font-medium" data-testid="event-signal">NEW · {sig.headline}</li>
        </ul>
        <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="text-xs text-muted">Bid<input data-testid="ev-bid" inputMode="numeric" value={bid} onChange={(e) => setBid(e.target.value)} className="mt-1 block w-24 rounded-md border border-border bg-bg px-3 py-2 font-mono text-lg focus:border-cyan focus:outline-none" /></label>
          <label className="text-xs text-muted">Ask<input data-testid="ev-ask" inputMode="numeric" value={ask} onChange={(e) => setAsk(e.target.value)} className="mt-1 block w-24 rounded-md border border-border bg-bg px-3 py-2 font-mono text-lg focus:border-cyan focus:outline-none" /></label>
          <Button type="submit" data-testid="ev-quote">Post quote</Button>
        </form>
        {err && <p className="mt-2 text-sm text-error">{err}</p>}
        {last && <div className="mt-5 rounded-md border border-border p-3 text-sm"><div>Last: {last.bid}/{last.ask} · fills {last.fills.map((f) => (f.side === "buy" ? "B" : "S") + (f.informed ? "*" : "")).join(" ") || "none"}</div>
          <p className="text-xs text-muted mt-1">{explainEventQuote(last, s.ledger.qty - last.fills.reduce((a, f) => a + (f.side === "buy" ? 1 : -1), 0))}</p></div>}
      </Card>
      <div className="space-y-2">
        <MetricGrid items={[{ label: "Inventory", value: s.ledger.qty }, { label: "Cash (pts)", value: s.ledger.cash }]} />
        <Notice>Reliability 50% carries no information; 90% moves log-odds by ln 9 ≈ 2.2.</Notice>
      </div>
    </div>
  );
}

function EventResults({ s, onAgain }: { s: EvState; onAgain: () => void }) {
  const m = summarizeEvents(s);
  return (
    <Card className="space-y-4" data-testid="game-results">
      <div className="flex justify-between items-baseline"><h2 className="text-lg font-semibold">Event {s.outcome ? "HAPPENED" : "did NOT happen"} · settled at {m.settle}</h2><span className="font-mono text-2xl text-teal" data-testid="game-score">{m.score.toFixed(1)}</span></div>
      <MetricGrid items={[
        { label: "P&L (points)", value: m.pnl, tone: m.pnl >= 0 ? "good" : "bad", sub: fmtCents(m.pnl) },
        { label: "Edge vs Bayesian fair", value: m.edgeVsFair.toFixed(1), sub: "sum over fills (points)" },
        { label: "Avg quote error", value: m.quoteError.toFixed(1), sub: "|mid − posterior×100|" },
        { label: "Fills", value: m.fills },
      ]} />
      <table className="w-full text-sm"><thead className="text-xs text-muted text-left"><tr><th>#</th><th>Signal</th><th>Posterior</th><th>Quote</th><th>Assessment</th></tr></thead>
        <tbody>{s.history.map((h, i) => <tr key={h.index} className="border-t border-border align-top"><td className="py-1">{i + 1}</td><td>{h.signal.saysYes ? "YES" : "NO"} @ {Math.round(h.signal.reliability * 100)}%</td><td className="font-mono text-cyan">{(h.posterior * 100).toFixed(1)}</td><td className="font-mono">{h.bid}/{h.ask}</td><td className="text-xs text-muted">{explainEventQuote(h, 0)}</td></tr>)}</tbody></table>
      <Button onClick={onAgain} data-testid="play-again">Play again</Button>
    </Card>
  );
}
