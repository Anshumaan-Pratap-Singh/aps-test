"use client";

import { useMemo, useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { randomSeed, uid } from "@/lib/rng";
import { enqueueGame } from "@/lib/sync";
import { impliedP, makeBoard, scoreBoard } from "./betting";
import { GameSetup, MetricGrid } from "./GameShell";

const BANKROLL = 1000;

export function BettingUI() {
  const [cfg, setCfg] = useState<{ id: string; seed: number; d: number; startedAt: number } | null>(null);
  const board = useMemo(() => (cfg ? makeBoard(cfg.seed, cfg.d) : []), [cfg]);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof scoreBoard> | null>(null);

  if (!cfg) return (
    <GameSetup title="Betting Board" onStart={(d) => { setCfg({ id: uid(), seed: randomSeed(), d, startedAt: Date.now() }); setStakes({}); setResult(null); }} rules={<>
      <p>An <strong>educational probability simulation</strong> with a virtual $1,000 bankroll — not real-money betting. Each event&apos;s true probability is exactly computable from dice, coins or cards. Odds are decimal (payout per $1 including stake) and include a bookmaker margin plus some mispricing.</p>
      <p>Find +EV prices: EV per $1 = p·(odds − 1) − (1 − p). Size with fractional Kelly: f* = (p·(odds−1) − (1−p)) / (odds − 1). The benchmark stakes ½-Kelly capped at 5% of bankroll.</p>
      <p>Your score is EV captured relative to the benchmark (not the simulated outcomes), with penalties for −EV bets and staking beyond full Kelly.</p>
    </>} />
  );

  const submit = async () => {
    const st = Object.fromEntries(board.map((e) => [e.id, Math.max(0, Number(stakes[e.id] ?? 0) || 0)]));
    const total = Object.values(st).reduce((a, b) => a + b, 0);
    if (total > BANKROLL) return;
    const r = scoreBoard(board, st, BANKROLL, cfg.seed);
    setResult(r);
    const g = { id: cfg.id, gameType: "betting_board", category: "market" as const, difficulty: cfg.d, seed: cfg.seed, startedAt: cfg.startedAt, endedAt: Date.now(), score: r.score,
      metrics: { ev: r.ev, benchEv: r.benchEv, realisedPnl: r.realised, mtmPnl: r.realised },
      events: Object.entries(st).map(([id, v], i) => ({ seq: i, type: "stake", payload: { id, stake: v }, t: 0 })), initialState: { seed: cfg.seed }, finalState: {}, synced: false };
    await db.saveGame(g); void enqueueGame(g);
  };

  const total = board.reduce((a, e) => a + (Number(stakes[e.id] ?? 0) || 0), 0);
  return (
    <Card className="space-y-4" data-testid="betting-game">
      <div className="flex justify-between text-sm"><span>Bankroll ${BANKROLL}</span><span className={total > BANKROLL ? "text-error" : "text-muted"}>Staked ${total.toFixed(2)}</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-xs text-muted text-left"><tr><th className="py-1">Event</th><th>Odds</th><th>Implied p</th><th>Stake ($)</th>{result && <><th>Fair p</th><th>EV/$</th><th>½-Kelly stake</th><th>Outcome</th></>}</tr></thead>
          <tbody>
            {board.map((e) => {
              const row = result?.rows.find((r) => r.id === e.id);
              return (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-1.5">{e.text}</td>
                  <td className="font-mono">{e.odds.toFixed(2)}</td>
                  <td className="font-mono text-muted">{(impliedP(e.odds) * 100).toFixed(1)}%</td>
                  <td><input aria-label={`Stake on ${e.text}`} disabled={!!result} inputMode="decimal" value={stakes[e.id] ?? ""} onChange={(ev) => setStakes({ ...stakes, [e.id]: ev.target.value })} className="w-20 rounded border border-border bg-bg px-2 py-1 font-mono" /></td>
                  {row && <>
                    <td className="font-mono text-cyan">{(row.p * 100).toFixed(1)}%</td>
                    <td className={`font-mono ${row.ev > 0 ? "text-teal" : "text-error"}`}>{row.ev.toFixed(3)}</td>
                    <td className="font-mono">{row.benchStake.toFixed(0)}</td>
                    <td className="font-mono">{row.stake ? (row.won ? `+${row.pnl.toFixed(0)}` : row.pnl.toFixed(0)) : row.won ? "✓" : "✗"}</td>
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!result ? (
        <div className="flex gap-2 items-center"><Button onClick={submit} disabled={total > BANKROLL} data-testid="betting-submit">Place bets</Button>{total > BANKROLL && <span className="text-sm text-error">Total stake exceeds bankroll.</span>}</div>
      ) : (
        <div className="space-y-3" data-testid="game-results">
          <MetricGrid items={[
            { label: "Score", value: <span data-testid="game-score">{result.score.toFixed(1)}</span>, tone: "accent" },
            { label: "Your EV", value: `$${result.ev.toFixed(2)}`, tone: result.ev >= 0 ? "good" : "bad" },
            { label: "Benchmark EV", value: `$${result.benchEv.toFixed(2)}` },
            { label: "Simulated P&L", value: `$${result.realised.toFixed(2)}`, sub: "luck — not scored" },
          ]} />
          <Button onClick={() => { setCfg({ id: uid(), seed: randomSeed(), d: cfg.d, startedAt: Date.now() }); setStakes({}); setResult(null); }} data-testid="play-again">New board</Button>
        </div>
      )}
      <Notice>Educational simulation using virtual currency only.</Notice>
    </Card>
  );
}
