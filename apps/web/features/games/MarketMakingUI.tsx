"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { fmtCents, realised } from "./framework";
import { GameSetup, MetricGrid, useGame } from "./GameShell";
import { explainRound, MarketMakingGame, MODEL, POINT, summarize, TICK, type MMState } from "./marketMaking";

const DIE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const CARD = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const toCents = (s: string) => { const v = Number(s); return Number.isFinite(v) ? Math.round((v * POINT) / TICK) * TICK : NaN; };

export function MarketMakingUI() {
  const g = useGame(MarketMakingGame);
  const [bid, setBid] = useState("");
  const [ask, setAsk] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const saved = useRef(false);
  const s = g.state;

  useEffect(() => {
    if (s?.over && !saved.current) {
      saved.current = true;
      const sum = summarize(s);
      void g.save(sum.score, { pnl: sum.pnl / 100, mtmPnl: sum.pnl / 100, realisedPnl: sum.realisedPnl / 100, spreadCaptured: sum.spreadCaptured / 100,
        adverseSelection: sum.adverseSelection / 100, maxAbsInventory: sum.maxAbsInventory, riskHits: sum.riskHits, fills: sum.fills, benchmarkPnl: sum.benchmarkPnl / 100 },
        { hidden: s.hidden, inventory: s.ledger.qty, cash: s.ledger.cash });
    }
  }, [s, g]);

  if (!s) {
    return (
      <GameSetup title="Market-Making Dice & Cards" onStart={(d) => { saved.current = false; g.begin(d); }} rules={<>
        <p>A hidden contract settles at the <strong>sum of N dice</strong> (even seeds) or <strong>N cards</strong> drawn without replacement (A=1 … K=13). One value is revealed per round; you post a two-sided quote each round.</p>
        <p>Counterparties then trade against you: some are <em>informed</em> (know the settlement), the rest hold noisy estimates of fair value. Each fill is one lot of 1 point = $1.00. Fills beyond your inventory limit are refused and count as risk-limit hits.</p>
        <p>You are scored against a reference maker quoting on the <em>same</em> flow (<code>h = {MODEL.H0} + {MODEL.K_SIGMA}σ + {MODEL.K_TOX}τσ</code>, skew <code>{MODEL.GAMMA}·q·σ²</code>), plus spread captured, minus risk violations. Maximising volume is not rewarded.</p>
      </>} />
    );
  }

  const inv = s.ledger.qty;
  const shown = s.hidden.slice(0, s.revealed);
  const glyph = (v: number) => (s.cfg.variant === "dice" ? DIE[v] : CARD[v]);

  const submit = () => {
    const b = toCents(bid), a = toCents(ask);
    if (!Number.isFinite(b) || !Number.isFinite(a)) return setErr("Enter numeric prices.");
    if (a <= b) return setErr("Ask must be above bid.");
    setErr(null);
    g.dispatch({ type: "quote", bid: b, ask: a });
  };

  if (s.over) return <MMResults s={s} onAgain={() => { saved.current = false; g.begin(s.difficulty); }} />;

  const last = s.rounds[s.rounds.length - 1];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]" data-testid="mm-game">
      <Card>
        <div className="flex justify-between text-xs text-muted"><span>Round {s.round + 1} / {s.cfg.rounds} · {s.cfg.variant === "dice" ? `${s.cfg.n} dice` : `${s.cfg.n} cards`}</span><span>Inventory limit ±{s.cfg.maxInventory}</span></div>
        <div className="my-6 flex flex-wrap items-center justify-center gap-3" aria-label="Revealed and hidden values">
          {s.hidden.map((v, i) => (
            <span key={i} className={`flex h-16 w-14 items-center justify-center rounded-md border text-3xl font-mono ${i < shown.length ? "border-cyan text-text" : "border-border text-muted"}`}>
              {i < shown.length ? glyph(v) : "?"}
            </span>
          ))}
        </div>
        <p className="text-center text-sm text-muted">Revealed sum <span className="font-mono text-text">{shown.reduce((a, b) => a + b, 0)}</span> · {s.cfg.n - shown.length} hidden</p>
        <form className="mt-6 flex flex-wrap items-end justify-center gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="text-xs text-muted">Bid (points)<input data-testid="mm-bid" inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)} className="mt-1 block w-28 rounded-md border border-border bg-bg px-3 py-2 font-mono text-lg focus:border-cyan focus:outline-none" /></label>
          <label className="text-xs text-muted">Ask (points)<input data-testid="mm-ask" inputMode="decimal" value={ask} onChange={(e) => setAsk(e.target.value)} className="mt-1 block w-28 rounded-md border border-border bg-bg px-3 py-2 font-mono text-lg focus:border-cyan focus:outline-none" /></label>
          <Button type="submit" data-testid="mm-quote">Post quote</Button>
        </form>
        {err && <p className="mt-2 text-center text-sm text-error">{err}</p>}
        {last && (
          <div className="mt-6 rounded-md border border-border p-3 text-sm" data-testid="mm-last-round">
            <div className="flex flex-wrap justify-between gap-2"><span>Last round: {fmtPts(last.bid)} / {fmtPts(last.ask)}</span><span className="text-muted">fair was <span className="font-mono text-cyan">{fmtPts(last.fairBefore)}</span> · σ {last.sigma.toFixed(2)} · model {fmtPts(last.modelBid)} / {fmtPts(last.modelAsk)}</span></div>
            <div className="mt-1 text-muted">{last.fills.length ? last.fills.map((f, i) => <span key={i} className={`mr-2 font-mono ${f.side === "buy" ? "text-teal" : "text-blue"}`}>{f.side === "buy" ? "bought" : "sold"}@{fmtPts(f.price)}{f.informed ? "*" : ""}</span>) : "No fills."} {last.refused > 0 && <span className="text-error">{last.refused} refused (limit)</span>}</div>
            <p className="mt-1 text-xs text-muted">{explainRound(last, inv - last.fills.reduce((a, f) => a + (f.side === "buy" ? 1 : -1), 0))} (* = informed counterparty)</p>
          </div>
        )}
      </Card>
      <div className="space-y-2">
        <MetricGrid items={[
          { label: "Inventory", value: inv, tone: Math.abs(inv) >= s.cfg.maxInventory ? "bad" : "default" },
          { label: "Cash", value: fmtCents(s.ledger.cash) },
          { label: "Realised P&L", value: fmtCents(Math.round(realised(s.ledger).toNumber())) },
          { label: "Fills", value: s.ledger.fills },
        ]} />
        <Notice>Fair value is not shown while quoting — compute it. With long inventory, skew both quotes down.</Notice>
        <Button variant="ghost" onClick={() => g.dispatch({ type: "end" })}>End & settle now</Button>
      </div>
    </div>
  );
}

const fmtPts = (c: number) => (c / POINT).toFixed(1);

function MMResults({ s, onAgain }: { s: MMState; onAgain: () => void }) {
  const sum = summarize(s);
  return (
    <div className="space-y-4" data-testid="game-results">
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Settled at <span className="font-mono text-cyan">{sum.settlement / POINT}</span></h2>
          <span className="font-mono text-2xl text-teal" data-testid="game-score">{sum.score.toFixed(1)}</span>
        </div>
        <p className="text-sm text-muted">Hidden values: {s.hidden.join(", ")} · seed {s.seed}</p>
        <div className="mt-4"><MetricGrid items={[
          { label: "Total P&L", value: fmtCents(sum.pnl), tone: sum.pnl >= 0 ? "good" : "bad" },
          { label: "Benchmark P&L", value: fmtCents(sum.benchmarkPnl), sub: "reference maker, same flow" },
          { label: "Realised P&L", value: fmtCents(Math.round(sum.realisedPnl)) },
          { label: "Spread captured", value: fmtCents(Math.round(sum.spreadCaptured)), sub: "edge vs fair at fill" },
          { label: "Adverse selection", value: fmtCents(Math.round(sum.adverseSelection)), sub: "edge lost to later information", tone: sum.adverseSelection > 0 ? "bad" : "good" },
          { label: "Avg |inventory|", value: sum.avgAbsInventory.toFixed(2), sub: `max ${sum.maxAbsInventory}` },
          { label: "Risk-limit hits", value: sum.riskHits, tone: sum.riskHits ? "bad" : "default" },
          { label: "Quote error", value: `${(sum.quoteError / POINT).toFixed(2)} pts`, sub: "|mid − fair| avg" },
          { label: "Avg width", value: `${(sum.avgWidth / POINT).toFixed(2)} pts` },
          { label: "Fills", value: sum.fills, sub: `${Math.round(sum.informedShare * 100)}% informed` },
        ]} /></div>
        <div className="mt-4"><Button onClick={onAgain} data-testid="play-again">Play again</Button></div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold mb-2">Round-by-round review</h3>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted text-left"><tr><th>#</th><th>Your quote</th><th>Fair</th><th>Model</th><th>Fills</th></tr></thead>
          <tbody className="font-mono num">
            {s.rounds.map((r) => (
              <tr key={r.index} className="border-t border-border align-top">
                <td className="py-1">{r.index + 1}</td><td>{fmtPts(r.bid)}/{fmtPts(r.ask)}</td><td className="text-cyan">{fmtPts(r.fairBefore)}</td><td className="text-muted">{fmtPts(r.modelBid)}/{fmtPts(r.modelAsk)}</td>
                <td>{r.fills.map((f) => (f.side === "buy" ? "B" : "S") + (f.informed ? "*" : "")).join(" ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
