"use client";

import { useMemo, useState } from "react";
import { SEQUENCE_FAMILIES } from "./generators/sequences";
import { TrainerSetup } from "./TrainerSetup";

const groupByFamily = (a: { tags: string[] }) => a.tags[1] ?? "sequence";

export function SequenceTrainer() {
  const [family, setFamily] = useState<string>("");
  const options = useMemo(() => (family ? { family } : {}), [family]);
  return (
    <TrainerSetup
      key={family}
      trainer="sequence"
      title="Configure sequence session"
      options={options}
      allowHints
      groupBy={groupByFamily}
      extraControls={
        <div>
          <label htmlFor="family" className="text-xs uppercase tracking-wider text-muted">Pattern family</label>
          <select id="family" value={family} onChange={(e) => setFamily(e.target.value)} className="mt-2 block rounded-md border border-border bg-bg px-3 py-2 text-sm">
            <option value="">All families eligible at this level</option>
            {SEQUENCE_FAMILIES.map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
          </select>
          <p className="text-xs text-muted mt-1">Hints (untimed modes) form a ladder: structure → transformation → rule. Wrong answers show the full rule.</p>
        </div>
      }
    />
  );
}
