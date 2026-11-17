"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button, Card, Stat } from "@/components/ui";
import { db, type LocalGame } from "@/lib/db";
import { randomSeed, uid } from "@/lib/rng";
import { enqueueGame } from "@/lib/sync";
import type { GameDef, LoggedAction } from "./framework";

/** Hook binding a pure GameDef to React with an append-only, timestamped action log. */
export function useGame<S, A extends { type: string }>(def: GameDef<S, A>) {
  const [state, setState] = useState<S | null>(null);
  const log = useRef<LoggedAction<A>[]>([]);
  const start = useRef(0);
  const meta = useRef<{ id: string; seed: number; difficulty: number; startedAt: number } | null>(null);
  const stateRef = useRef<S | null>(null);

  const begin = useCallback((difficulty: number, seed = randomSeed()) => {
    const s = def.init(seed, difficulty);
    log.current = [];
    start.current = performance.now();
    meta.current = { id: uid(), seed, difficulty, startedAt: Date.now() };
    stateRef.current = s;
    setState(s);
    return s;
  }, [def]);

  const dispatch = useCallback((a: A) => {
    const cur = stateRef.current;
    if (!cur || def.isOver(cur)) return cur;
    log.current.push({ seq: log.current.length, t: performance.now() - start.current, action: a });
    const next = def.reduce(cur, a);
    stateRef.current = next;
    setState(next);
    return next;
  }, [def]);

  /** Persist the finished game locally and queue it for sync. */
  const save = useCallback(async (score: number, metrics: LocalGame["metrics"], finalState: Record<string, unknown>, category: LocalGame["category"] = "market") => {
    const m = meta.current;
    if (!m) return;
    const g: LocalGame = {
      id: m.id, gameType: def.type, category, difficulty: m.difficulty, seed: m.seed, startedAt: m.startedAt, endedAt: Date.now(), score,
      metrics: { ...metrics, engineVersion: def.version }, initialState: { seed: m.seed, difficulty: m.difficulty, engine: def.version },
      finalState, events: log.current.map((e) => ({ seq: e.seq, type: e.action.type, payload: e.action as unknown as Record<string, unknown>, t: e.t })), synced: false,
    };
    await db.saveGame(g);
    void enqueueGame(g);
  }, [def]);

  return { state, begin, dispatch, save, log, meta };
}

export function GameSetup({ title, rules, onStart, defaultDifficulty = 4, children }: {
  title: string; rules: ReactNode; onStart: (difficulty: number) => void; defaultDifficulty?: number; children?: ReactNode;
}) {
  const [d, setD] = useState(defaultDifficulty);
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-sm text-muted leading-relaxed space-y-2">{rules}</div>
      {children}
      <div>
        <label htmlFor="gd" className="text-xs uppercase tracking-wider text-muted">Difficulty <span className="font-mono text-cyan">{d}</span>/10</label>
        <input id="gd" type="range" min={1} max={10} value={d} onChange={(e) => setD(Number(e.target.value))} className="w-full accent-[#00E5FF]" />
      </div>
      <Button onClick={() => onStart(d)} data-testid="start-game">Start game</Button>
      <p className="text-xs text-muted">Synthetic data only. Each game is reproducible from its seed and recorded actions; the full event log is saved with your result.</p>
    </Card>
  );
}

export function MetricGrid({ items }: { items: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "accent" | "default" }[] }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{items.map((i) => <Stat key={i.label} {...i} />)}</div>;
}
