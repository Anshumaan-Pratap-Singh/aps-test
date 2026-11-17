"use client";

import { useEffect, useRef, useState } from "react";
import { LineChart } from "@/components/charts";
import { Button, Card, Notice } from "@/components/ui";
import { EtfGame, summarizeEtf, type EtfState } from "./etf";
import { fmtCents } from "./framework";
import { GameSetup, MetricGrid, useGame } from "./GameShell";

export function EtfUI() {
  const g = useGame(EtfGame);
  const [units, setUnits] = useState(2);
  const saved = useRef(false);
  const s = g.state;
  const running = !!s && !s.over;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => g.dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, [running, g.dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (s?.over && !saved.current) {
      saved.current = true;
      const m = summarizeEtf(s);
      void g.save(m.score, { netPnl: m.netPnl / 100, mtmPnl: m.netPnl / 100, grossPnl: m.grossPnl / 100, costs: m.costs / 100, trades: m.trades, missedTicks: m.missedTicks, botTrades: m.botTrades },
        { etfUnits: s.etfUnits, basketUnits: s.basketUnits, cash: s.cash });
    }
  }, [s, g]);

  if (!s) {
    return (
      <GameSetup title="ETF Arbitrage" defaultDifficulty={5} onStart={(d) => { saved.current = false; g.begin(d); }} rules={<>
        <p>An ETF tracks a 4-stock basket (one stock in EUR). NAV per share = Σ shares × price × FX. The ETF trades at a drifting premium/discount to NAV. Each tick is one second; the session lasts 60 ticks.</p>
        <p><strong>Sell ETF / buy basket</strong> when the ETF is rich; <strong>buy ETF / sell basket</strong> when cheap. Your ETF leg fills now at the bid/ask (beyond the displayed depth you pay impact per unit); the basket leg fills on the next tick — <em>legging risk</em>. Fees and basket bps apply to every trade.</p>
        <p>Three AI arbitrageurs with different thresholds and reaction speeds compete for the same dislocations. Score rewards <em>net</em> P&amp;L after costs and penalises missed positive-edge ticks. From difficulty 6 the net edge is hidden — compute it.</p>
      </>} />
    );
  }
  if (s.over) return <EtfResults s={s} onAgain={() => { saved.current = false; g.begin(s.difficulty); }} />;

  const v = s.history[s.history.length - 1]!;
  const premiumBps = ((v.etfBid + v.etfAsk) / 2 / v.nav - 1) * 10000;
  const feeUnit = s.cfg.feePerUnit + Math.round((v.nav * s.cfg.basketFeeBps) / 10000);
  const hideEdge = s.difficulty >= 6;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]" data-testid="etf-game">
      <Card>
        <div className="flex justify-between text-xs text-muted"><span>Tick {s.t}/{s.cfg.ticks}</span><span>{s.pendingBasket ? "Basket leg in flight…" : "Ready"}</span></div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono num">
          <Quote label="ETF bid" v={fmtCents(v.etfBid)} /><Quote label="ETF ask" v={fmtCents(v.etfAsk)} />
          <Quote label="NAV (mid)" v={fmtCents(v.nav)} accent /><Quote label="Premium" v={`${premiumBps.toFixed(1)} bp`} tone={Math.abs(premiumBps) > 5 ? "warn" : undefined} />
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-xs text-muted text-left"><tr><th>Stock</th><th>Shares/ETF</th><th>Bid</th><th>Ask</th><th>FX</th></tr></thead>
          <tbody className="font-mono num">
            {s.cons.map((c) => <tr key={c.sym} className="border-t border-border"><td className="font-sans">{c.sym} <span className="text-muted text-xs">{c.ccy}</span></td><td>{c.shares}</td><td>{fmtCents(c.price - c.halfSpread)}</td><td>{fmtCents(c.price + c.halfSpread)}</td><td>{c.fx.toFixed(4)}</td></tr>)}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Basket bid/ask NAV: {fmtCents(v.navBid)} / {fmtCents(v.navAsk)} · costs ≈ {fmtCents(feeUnit)} per unit (+ impact beyond depth {s.cfg.depth}) {!hideEdge && <>· net edge sell-ETF <span className={v.edgeRich > 0 ? "text-teal" : ""}>{fmtCents(v.edgeRich)}</span>, buy-ETF <span className={v.edgeCheap > 0 ? "text-teal" : ""}>{fmtCents(v.edgeCheap)}</span></>}</p>
        <div className="mt-4">
          <LineChart ariaLabel="ETF premium to NAV in basis points" height={150} zeroLine series={[{ label: "premium (bp)", color: "#00E5FF", points: s.history.map((h) => ({ x: h.t, y: ((h.etfBid + h.etfAsk) / 2 / h.nav - 1) * 10000 })) }]} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">Units <input type="number" min={1} max={5} value={units} onChange={(e) => setUnits(Number(e.target.value))} className="ml-1 w-16 rounded border border-border bg-bg px-2 py-1 font-mono" /></label>
          <Button onClick={() => g.dispatch({ type: "arb_rich", units })} disabled={!!s.pendingBasket} data-testid="etf-sell">Sell ETF / Buy basket</Button>
          <Button onClick={() => g.dispatch({ type: "arb_cheap", units })} disabled={!!s.pendingBasket} data-testid="etf-buy">Buy ETF / Sell basket</Button>
          <Button variant="ghost" onClick={() => g.dispatch({ type: "unwind" })} disabled={!!s.pendingBasket}>Unwind all</Button>
        </div>
      </Card>
      <div className="space-y-2">
        <MetricGrid items={[
          { label: "ETF units", value: s.etfUnits }, { label: "Basket units", value: s.basketUnits + (s.pendingBasket?.units ?? 0), sub: s.pendingBasket ? "incl. pending" : undefined },
          { label: "Cash", value: fmtCents(s.cash) }, { label: "Costs paid", value: fmtCents(s.costs) },
          { label: "Bot trades", value: s.botTrades }, { label: "Missed edge ticks", value: s.missedTicks, tone: s.missedTicks ? "bad" : "default" },
        ]} />
        <Notice>Gross premium ≠ profit: sell at the ETF bid, buy the basket at constituent asks, then subtract costs.</Notice>
      </div>
    </div>
  );
}

function Quote({ label, v, accent, tone }: { label: string; v: string; accent?: boolean; tone?: "warn" }) {
  return <div className="rounded-md border border-border bg-bg px-3 py-2"><div className="text-[10px] uppercase tracking-wider text-muted font-sans">{label}</div><div className={`text-lg ${accent ? "text-cyan" : tone ? "text-blue" : ""}`}>{v}</div></div>;
}

function EtfResults({ s, onAgain }: { s: EtfState; onAgain: () => void }) {
  const m = summarizeEtf(s);
  return (
    <Card className="space-y-4" data-testid="game-results">
      <div className="flex justify-between items-baseline"><h2 className="text-lg font-semibold">ETF session complete</h2><span className="font-mono text-2xl text-teal" data-testid="game-score">{m.score.toFixed(1)}</span></div>
      <MetricGrid items={[
        { label: "Net P&L", value: fmtCents(Math.round(m.netPnl)), tone: m.netPnl >= 0 ? "good" : "bad" }, { label: "Gross P&L", value: fmtCents(Math.round(m.grossPnl)) },
        { label: "Trading costs", value: fmtCents(m.costs) }, { label: "Trades", value: m.trades },
        { label: "Avg quoted edge", value: fmtCents(Math.round(m.avgQuotedEdge)), sub: "at decision" }, { label: "Avg realised edge", value: fmtCents(Math.round(m.avgRealisedEdge)), sub: "after legging" },
        { label: "Missed opportunities", value: m.missedTicks, sub: `${fmtCents(Math.round(m.missedEdge))} of edge` }, { label: "Open exposure", value: m.exposure, sub: "ETF + basket units" },
        { label: "Risk-adjusted", value: fmtCents(Math.round(m.riskAdjusted)), sub: "net / √(1+max exposure)" }, { label: "Bot trades", value: m.botTrades },
      ]} />
      <p className="text-sm text-muted">Execution quality is the gap between quoted and realised edge: it widens when the basket moves during the legging tick or when size exceeds displayed depth.</p>
      <Button onClick={onAgain} data-testid="play-again">Play again</Button>
    </Card>
  );
}
