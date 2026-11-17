"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { LocalSession } from "@/lib/db";
import { parseNumber, q } from "@/lib/rational";
import { randomSeed, Rng } from "@/lib/rng";
import { fmtMs, median } from "@/lib/stats";
import type { DisplayQuestion } from "./engine";
import { RECOGNITION_TABLE, type FractionKind } from "./generators/fractions";
import { TrainerConsole } from "./TrainerConsole";
import { TrainerSetup } from "./TrainerSetup";

const KINDS: { key: FractionKind; label: string }[] = [
  { key: "to_pct", label: "Fraction → %" }, { key: "to_dec", label: "Fraction → decimal" }, { key: "from_dec", label: "Decimal → fraction" },
  { key: "simplify", label: "Simplify" }, { key: "compare", label: "Compare" },
];

/** Recognition question: a/b → percentage to 2 d.p. (exact when terminating). */
function recognitionQuestion(rng: Rng, i: number, stage: number): DisplayQuestion {
  const pool = RECOGNITION_TABLE.slice(0, Math.min(RECOGNITION_TABLE.length, 10 + stage * 10));
  const [n, d] = rng.pick(pool);
  const pct = q(n * 100, d);
  const exact = pct.isTerminating();
  const disp = exact ? pct.toString() : pct.toNumber().toFixed(2);
  return {
    id: `recog:${n}/${d}:${i}`, type: "fraction_recognition", seed: i, version: "web-1.0", prompt: `\\frac{${n}}{${d}} = ?\\%`, inputType: "numeric",
    tags: ["fractions", "recognition"], hints: [], solution: [`\\frac{${n}}{${d}} = ${exact ? pct.toString() : pct.toNumber().toFixed(4) + "\\ldots"}\\%`],
    answerDisplay: disp,
    grade: (input) => {
      const v = parseNumber(input);
      if (!v) return false;
      return exact ? v.eq(pct) : Math.abs(v.toNumber() - pct.toNumber()) <= 0.005 + 1e-12;
    },
  };
}

export function FractionTrainer() {
  const [kinds, setKinds] = useState<FractionKind[]>([]);
  const options = useMemo(() => (kinds.length ? { fractionKinds: kinds } : {}), [kinds]);
  const [recog, setRecog] = useState<{ seed: number; stage: number } | null>(null);
  const [recogResults, setRecogResults] = useState<LocalSession | null>(null);

  const recogSource = useMemo(() => {
    if (!recog) return null;
    const rng = new Rng(`recog:${recog.seed}`);
    const qs = Array.from({ length: 20 }, (_, i) => recognitionQuestion(rng, i, recog.stage));
    return (i: number) => qs[i]!;
  }, [recog]);

  const onRecogFinish = useCallback((s: LocalSession) => setRecogResults(s), []);

  if (recog && recogSource) {
    return (
      <div className="space-y-3">
        <TrainerConsole key={recog.seed} autoStart showFeedback questionAt={recogSource} questionLimit={20} durationMs={90_000}
          meta={{ trainer: "fraction_recognition", category: "mental_math", mode: "timed", configKey: `recognition_stage_${recog.stage}`, difficulty: Math.min(10, 2 + recog.stage * 2), seed: recog.seed }}
          onFinish={onRecogFinish} onExit={() => { setRecog(null); setRecogResults(null); }}
          resultsExtra={(s) => <RecognitionSplit s={s} />} />
        {recogResults && recog.stage < 2 && <Button variant="ghost" onClick={() => { setRecogResults(null); setRecog({ seed: randomSeed(), stage: recog.stage + 1 }); }}>Next stage (larger table) →</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold">Recognition rounds</h2>
        <p className="text-sm text-muted mt-1">20 flash conversions in 90 seconds from the core table (1/8 → 12.5, 3/16 → 18.75, 7/40 → 17.5…). Stage 1 uses the 20 most common fractions; later stages add the full table. Recognition speed (correct answers) is reported separately from accuracy.</p>
        <div className="mt-3 flex gap-2">
          {[0, 1, 2].map((st) => <Button key={st} variant={st === 0 ? "primary" : "ghost"} onClick={() => setRecog({ seed: randomSeed(), stage: st })}>Stage {st + 1}</Button>)}
        </div>
      </Card>
      <TrainerSetup key={kinds.join(",")} trainer="fraction_conversion" title="Conversion practice" options={options}
        groupBy={(a) => a.tags[1] ?? "fractions"}
        extraControls={
          <fieldset>
            <legend className="text-xs uppercase tracking-wider text-muted mb-2">Conversion types (none selected = all)</legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => {
                const on = kinds.includes(k.key);
                return <button key={k.key} aria-pressed={on} onClick={() => setKinds((ks) => (on ? ks.filter((x) => x !== k.key) : [...ks, k.key]))}
                  className={`rounded-md border px-3 py-1.5 text-sm ${on ? "border-cyan text-cyan bg-elevated" : "border-border text-muted"}`}>{k.label}</button>;
              })}
            </div>
          </fieldset>
        } />
    </div>
  );
}

function RecognitionSplit({ s }: { s: LocalSession }) {
  const ok = s.attempts.filter((a) => a.correct);
  const bad = s.attempts.filter((a) => a.correct === false);
  return (
    <Card>
      <h3 className="text-sm font-semibold">Recognition vs accuracy</h3>
      <p className="text-sm text-muted mt-1">
        Recognition speed (median time on <em>correct</em> answers): <span className="font-mono text-teal">{fmtMs(median(ok.map((a) => a.responseMs)))}</span>.
        Time on incorrect answers: <span className="font-mono text-error">{fmtMs(median(bad.map((a) => a.responseMs)))}</span>.
        Accuracy: <span className="font-mono">{s.attempts.length ? Math.round((ok.length / s.attempts.length) * 100) : 0}%</span>.
      </p>
    </Card>
  );
}
