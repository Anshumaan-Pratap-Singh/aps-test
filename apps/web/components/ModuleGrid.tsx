"use client";

import { ModuleCard, type Status } from "./ui";
import { summarize, useLocalData } from "@/lib/useLocal";
import { fmtPct } from "@/lib/stats";

export interface ModuleDef {
  href?: string;
  title: string;
  description: string;
  difficulty?: number;
  status?: Status;
  /** match local sessions (trainer key) or games (game type) for stats */
  trainer?: string;
  game?: string;
  lesson?: string;
}

/** Module cards with personal bests and progress from local history. */
export function ModuleGrid({ modules }: { modules: ModuleDef[] }) {
  const { sessions, games, lessons } = useLocalData();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => {
        let meta: string | undefined;
        let progress: number | null = null;
        if (m.trainer && sessions) {
          const s = summarize(sessions, (x) => x.trainer === m.trainer || (m.trainer === "*arith" && x.category === "mental_math"));
          meta = s.sessions ? `best net ${s.bestNet} · ${fmtPct(s.accuracy)} acc` : "no sessions yet";
          progress = s.attempts ? Math.min(1, s.attempts / 200) : 0;
        } else if (m.game && games) {
          const gs = games.filter((g) => g.gameType === m.game && g.endedAt);
          const best = gs.reduce<number | null>((b, g) => (g.score == null ? b : b == null ? g.score : Math.max(b, g.score)), null);
          meta = gs.length ? `best ${best?.toFixed(1)} · ${gs.length} played` : "not played";
          progress = Math.min(1, gs.length / 10);
        } else if (m.lesson && lessons) {
          const l = lessons.find((x) => x.id === m.lesson);
          meta = l ? (l.status === "completed" ? "completed" : "in progress") : "not started";
          progress = l ? (l.status === "completed" ? 1 : 0.5) : 0;
        }
        return <ModuleCard key={m.title} {...m} meta={meta} progress={m.status === "planned" ? null : progress} />;
      })}
    </div>
  );
}
