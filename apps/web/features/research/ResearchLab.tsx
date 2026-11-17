"use client";

import { useMemo, useState } from "react";
import { LineChart, ScatterPlot } from "@/components/charts";
import { Button, Card, Notice, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { randomSeed } from "@/lib/rng";
import { backtest, bestOfNoise, corr, FEATURE_INFO, leakDiagnostic, makeDataset, ols, oosR2 } from "./lab";

const pct = (x: number, d = 2) => `${(x * 100).toFixed(d)}%`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="space-y-3">
      <h2 className="text-base font-semibold"><span className="mr-2 font-mono text-cyan">{n}.</span>{title}</h2>
      {children}
    </Card>
  );
}

export function ResearchLab() {
  const [seed, setSeed] = useState(() => 20260101);
  const [regimeBreak, setRegimeBreak] = useState(false);
  const ds = useMemo(() => makeDataset(seed, { regimeBreak }), [seed, regimeBreak]);
  const [feature, setFeature] = useState("signal_obs");
  const [trainFrac, setTrainFrac] = useState(0.6);
  const [costBps, setCostBps] = useState(2);
  const [mined, setMined] = useState<{ name: string; t: number } | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const trainEnd = Math.floor(ds.n * trainFrac);
  const featName = mined?.name ?? feature;
  const x = ds.features[featName] as number[];
  const y = ds.returns;
  const fit = useMemo(() => ols(x.slice(0, trainEnd), y.slice(0, trainEnd)), [x, y, trainEnd]);
  const trainMean = useMemo(() => y.slice(0, trainEnd).reduce((a, b) => a + b, 0) / trainEnd, [y, trainEnd]);
  const predTest = useMemo(() => x.slice(trainEnd).map((v) => fit.intercept + fit.slope * v), [x, fit, trainEnd]);
  const predTrain = useMemo(() => x.slice(0, trainEnd).map((v) => fit.intercept + fit.slope * v), [x, fit, trainEnd]);
  const r2oos = oosR2(predTest, y.slice(trainEnd), trainMean);
  const icTest = corr(predTest, y.slice(trainEnd));
  const btTest = useMemo(() => backtest(predTest, y.slice(trainEnd), costBps), [predTest, y, trainEnd, costBps]);
  const btTrain = useMemo(() => backtest(predTrain, y.slice(0, trainEnd), costBps), [predTrain, y, trainEnd, costBps]);
  const leak = useMemo(() => leakDiagnostic(ds, featName), [ds, featName]);

  const info = FEATURE_INFO[featName];
  const truth = info?.leaks ? "leak" : featName.startsWith("noise") ? "mined" : featName === "momentum_5" ? "no_signal" : regimeBreak ? "regime" : btTest.sharpeNet > 0.3 ? "credible" : "weak";
  const truthText: Record<string, string> = {
    leak: `Not credible: ${info?.label} leaks future information (${info?.why}). The out-of-sample result is an artefact.`,
    mined: "Not credible: the feature was selected as the best of 20 pure-noise series on the training data. Its in-sample t-statistic is a multiple-testing artefact; out of sample it has no edge.",
    no_signal: "Not credible: momentum_5 has no predictive relationship by construction; any in-sample fit is noise.",
    regime: "Fragile: the relationship changes sign after the regime break at day 700, which lies in your test window. A walk-forward evaluation shows the decay; sizing should account for non-stationarity.",
    credible: "Plausibly credible: a legitimate, point-in-time feature with consistent in- and out-of-sample sign and positive net Sharpe after costs. Next: walk-forward refits, capacity and impact analysis.",
    weak: "Weak: the feature is legitimate but the edge does not survive costs or is statistically indistinguishable from zero out of sample.",
  };
  const options = [
    { key: "credible", label: "Credible after costs" }, { key: "leak", label: "Leakage / look-ahead" }, { key: "mined", label: "Data-mined (multiple testing)" },
    { key: "no_signal", label: "No real signal" }, { key: "regime", label: "Regime change / non-stationary" }, { key: "weak", label: "Legitimate but too weak after costs" },
  ];

  const submit = async () => {
    setSubmitted(true);
    const prev = (await db.allLessons()).find((l) => l.id === "lab:research");
    await db.saveLesson({ id: "lab:research", status: "in_progress", checksCorrect: (prev?.checksCorrect ?? 0) + (verdict === truth ? 1 : 0), checksTotal: (prev?.checksTotal ?? 0) + 1, updatedAt: Date.now() });
  };

  return (
    <div className="space-y-4">
      <Notice>All data are synthetic and generated in your browser from a seed (currently <span className="font-mono">{seed}</span>). Every chart plots exactly the numbers used in the calculations below.</Notice>
      <Step n={1} title="Inspect the dataset">
        <div className="flex flex-wrap gap-3 items-center text-sm">
          <Button variant="ghost" onClick={() => { setSeed(randomSeed()); setSubmitted(false); setVerdict(null); setMined(null); }}>New dataset</Button>
          <label className="flex items-center gap-2"><input type="checkbox" checked={regimeBreak} onChange={(e) => { setRegimeBreak(e.target.checked); setSubmitted(false); }} /> Include an unannounced regime change</label>
        </div>
        <LineChart ariaLabel="Synthetic price series" height={170} series={[{ label: "price", color: "#00E5FF", points: ds.price.map((p, i) => ({ x: i, y: p })) }]} verticalMarkers={[{ x: trainEnd, label: "train | test" }]} />
        <p className="text-xs text-muted">{ds.n} trading days. Target: next-day return y_t = r_(t+1). Daily return s.d. ≈ {pct(Math.sqrt(y.reduce((a, b) => a + b * b, 0) / y.length))}.</p>
      </Step>

      <Step n={2} title="Choose a candidate predictive feature">
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(FEATURE_INFO).map(([k, v]) => (
            <button key={k} onClick={() => { setFeature(k); setMined(null); setSubmitted(false); }} aria-pressed={featName === k}
              className={`text-left rounded-md border p-3 ${featName === k ? "border-cyan bg-elevated" : "border-border"}`}>
              <div className="text-sm font-medium">{v.label} <code className="text-xs text-muted">{k}</code></div>
              <div className="text-xs text-muted">{v.formula}</div>
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => { setMined(bestOfNoise(ds, trainEnd)); setSubmitted(false); }}>Search 20 alternative features for the best in-sample fit</Button>
        {mined && <p className="text-sm text-blue">Search selected <code>{mined.name}</code> with in-sample t = {mined.t.toFixed(2)} (out of 20 candidates).</p>}
      </Step>

      <Step n={3} title="Split chronologically">
        <label className="text-sm">Training fraction <span className="font-mono text-cyan">{Math.round(trainFrac * 100)}%</span> ({trainEnd} train / {ds.n - trainEnd} test days)
          <input type="range" min={0.3} max={0.85} step={0.05} value={trainFrac} onChange={(e) => { setTrainFrac(Number(e.target.value)); setSubmitted(false); }} className="block w-full accent-[#00E5FF]" /></label>
        <p className="text-xs text-muted">The model is fitted only on days before the split and evaluated only on days after it. A random split would put tomorrow&apos;s data in training — with autocorrelated features that inflates results.</p>
      </Step>

      <Step n={4} title="Train a simple model (OLS on the training window)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Slope β̂" value={fit.slope.toExponential(2)} /><Stat label="t-statistic" value={fit.tStat.toFixed(2)} tone={Math.abs(fit.tStat) > 2 ? "accent" : "default"} />
          <Stat label="In-sample R²" value={pct(fit.r2, 3)} /><Stat label="Train obs" value={fit.n} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ScatterPlot ariaLabel="Training scatter of feature vs next-day return with OLS line" xLabel={featName} yLabel="next-day return" points={x.slice(0, trainEnd).map((v, i) => ({ x: v, y: y[i] as number }))} line={{ slope: fit.slope, intercept: fit.intercept }} />
          <ScatterPlot ariaLabel="Residuals vs fitted values (training)" xLabel="fitted" yLabel="residual" color="#3185D8" points={predTrain.map((p, i) => ({ x: p, y: fit.residuals[i] as number }))} />
        </div>
      </Step>

      <Step n={5} title="Evaluate out of sample">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="OOS R²" value={pct(r2oos, 3)} tone={r2oos > 0 ? "good" : "bad"} sub="vs training-mean forecast" /><Stat label="OOS IC" value={icTest.toFixed(3)} sub="corr(pred, y)" />
          <Stat label="Hit rate" value={pct(btTest.hitRate, 1)} /><Stat label="Sharpe (gross)" value={btTest.sharpeGross.toFixed(2)} sub={`in-sample ${btTrain.sharpeGross.toFixed(2)}`} />
        </div>
      </Step>

      <Step n={6} title="Introduce transaction costs">
        <label className="text-sm">Cost per unit of turnover: <span className="font-mono text-cyan">{costBps} bp</span>
          <input type="range" min={0} max={20} step={0.5} value={costBps} onChange={(e) => setCostBps(Number(e.target.value))} className="block w-full accent-[#00E5FF]" /></label>
        <LineChart ariaLabel="Cumulative out-of-sample returns before and after costs" height={190} zeroLine
          series={[{ label: "gross", color: "#00F5D4", points: btTest.cumGross.map((v, i) => ({ x: trainEnd + i, y: v * 100 })) },
            { label: "net of costs", color: "#FF4D4D", points: btTest.cumNet.map((v, i) => ({ x: trainEnd + i, y: v * 100 })) }]} yLabel="cumulative %" xLabel="day" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Sharpe net" value={btTest.sharpeNet.toFixed(2)} tone={btTest.sharpeNet > 0 ? "good" : "bad"} /><Stat label="Daily turnover" value={pct(btTest.turnover, 0)} />
          <Stat label="Cost drag / yr" value={pct((btTest.turnover * costBps * 252) / 10000, 1)} /><Stat label="Total net" value={pct(btTest.cumNet[btTest.cumNet.length - 1] ?? 0, 1)} />
        </div>
      </Step>

      <Step n={7} title="Diagnose overfitting and leakage">
        <ul className="text-sm space-y-1">
          <li>Sharpe in-sample {btTrain.sharpeGross.toFixed(2)} → out-of-sample {btTest.sharpeGross.toFixed(2)} (gap {(btTrain.sharpeGross - btTest.sharpeGross).toFixed(2)}). A large drop suggests overfitting or selection.</li>
          <li>Feature correlation with the same-day return r_t: <span className="font-mono">{leak.corrSameDay.toFixed(3)}</span>, next-day target r_(t+1): <span className="font-mono">{leak.corrNext.toFixed(3)}</span>, two days ahead r_(t+2): <span className="font-mono">{leak.corrTwoAhead.toFixed(3)}</span>. A legitimate daily signal rarely correlates with returns two days ahead as strongly as with tomorrow.</li>
          {mined && <li>Multiple testing: with 20 candidates, the chance that at least one noise series shows |t| &gt; 2 in-sample is about {pct(1 - 0.954 ** 20, 0)}. Bonferroni threshold at 5%: |t| &gt; 3.02.</li>}
        </ul>
      </Step>

      <Step n={8} title="Is the strategy credible?">
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <button key={o.key} disabled={submitted} onClick={() => setVerdict(o.key)} aria-pressed={verdict === o.key}
              className={`rounded-md border p-2 text-left text-sm ${verdict === o.key ? "border-cyan bg-elevated" : "border-border"}`}>{o.label}</button>
          ))}
        </div>
        <Button onClick={submit} disabled={!verdict || submitted} data-testid="lab-submit">Submit assessment</Button>
        {submitted && <p className={`text-sm ${verdict === truth ? "text-teal" : "text-error"}`} data-testid="lab-verdict">{verdict === truth ? "✓ " : "✗ "}{truthText[truth]}</p>}
        {submitted && <p className="text-xs text-muted">Data-generating process: true β = {ds.beta} on the latent signal before day {ds.breakAt}{regimeBreak ? `, ×(${ds.kappa}) after` : ""}; daily noise s.d. 1%.</p>}
      </Step>
    </div>
  );
}
