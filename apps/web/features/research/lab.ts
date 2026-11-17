/**
 * Research-lab numerics on a synthetic dataset (no real market data).
 *
 * Data-generating process (known to the lab, hidden from the student until the end):
 *   s_t = φ s_{t−1} + η_t                    latent signal, φ = 0.9
 *   r_{t+1} = β_t s_t + ε_{t+1}              next-day return; β_t = β before the regime break, β·κ after
 *   features at time t (all observable at the close of day t unless stated):
 *     signal_obs   = s_t + noise                         legitimate, weakly predictive
 *     momentum_5   = mean(r_{t−4..t})                     legitimate, ~unrelated by construction
 *     centred_ma   = mean(r_{t−2..t+2})                   LEAKS: uses r_{t+1}, r_{t+2}
 *     zscore_full  = (signal_obs − full-sample mean)/sd   mild LEAK (full-sample statistics)
 *     noise_k      = pure noise, k = 1..20                for the multiple-testing demonstration
 */
import { Rng } from "@/lib/rng";

export interface Dataset { n: number; returns: number[]; price: number[]; features: Record<string, number[]>; breakAt: number; beta: number; kappa: number }

export const FEATURE_INFO: Record<string, { label: string; formula: string; leaks: boolean; why?: string }> = {
  signal_obs: { label: "Order-flow imbalance (observed)", formula: "s_t + measurement noise, computed from day-t data", leaks: false },
  momentum_5: { label: "5-day momentum", formula: "mean of returns r_{t−4} … r_t", leaks: false },
  centred_ma: { label: "Centred 5-day moving average", formula: "mean of returns r_{t−2} … r_{t+2}", leaks: true, why: "includes r_{t+1} and r_{t+2}, which are not known at time t" },
  zscore_full: { label: "Imbalance z-score (full sample)", formula: "(signal_obs − mean_all)/sd_all using the entire dataset", leaks: true, why: "normalises with statistics from the test period" },
};

export function makeDataset(seed: number, opts: { n?: number; beta?: number; regimeBreak?: boolean } = {}): Dataset {
  const n = opts.n ?? 1000, beta = opts.beta ?? 0.0006, kappa = opts.regimeBreak ? -0.2 : 1;
  const r = new Rng(`lab:${seed}`);
  const breakAt = Math.floor(n * 0.7);
  const s: number[] = [0];
  for (let t = 1; t < n + 3; t++) s.push(0.9 * (s[t - 1] as number) + r.normal());
  const ret: number[] = [0];
  for (let t = 0; t < n + 2; t++) {
    const b = t < breakAt ? beta : beta * kappa;
    ret.push(b * (s[t] as number) + 0.01 * r.normal());
  }
  const signalObs = s.slice(0, n).map((v) => v + 0.8 * r.normal());
  const mean = signalObs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(signalObs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const feats: Record<string, number[]> = {
    signal_obs: signalObs,
    momentum_5: Array.from({ length: n }, (_, t) => avg(ret.slice(Math.max(0, t - 4), t + 1))),
    centred_ma: Array.from({ length: n }, (_, t) => avg(ret.slice(Math.max(0, t - 2), t + 3))),
    zscore_full: signalObs.map((v) => (v - mean) / sd),
  };
  for (let k = 1; k <= 20; k++) feats[`noise_${k}`] = Array.from({ length: n }, () => r.normal());
  // target aligned to features: y_t = r_{t+1}
  const y = Array.from({ length: n }, (_, t) => ret[t + 1] as number);
  const price: number[] = [100];
  for (let t = 1; t < n; t++) price.push((price[t - 1] as number) * (1 + (ret[t] as number)));
  return { n, returns: y, price, features: feats, breakAt, beta, kappa };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export interface Fit { slope: number; intercept: number; r2: number; tStat: number; n: number; residuals: number[] }

export function ols(x: number[], y: number[]): Fit {
  const n = x.length;
  const mx = avg(x), my = avg(y);
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = (x[i] as number) - mx, dy = (y[i] as number) - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
  const residuals = x.map((xi, i) => (y[i] as number) - (intercept + slope * xi));
  const sse = residuals.reduce((a, e) => a + e * e, 0);
  const se = Math.sqrt(sse / Math.max(1, n - 2) / (sxx || 1));
  return { slope, intercept, r2: syy ? 1 - sse / syy : 0, tStat: se ? slope / se : 0, n, residuals };
}

/** Out-of-sample R² relative to the TRAINING mean forecast (the honest benchmark). */
export function oosR2(pred: number[], y: number[], trainMean: number): number {
  let sse = 0, sst = 0;
  for (let i = 0; i < y.length; i++) { sse += ((y[i] as number) - (pred[i] as number)) ** 2; sst += ((y[i] as number) - trainMean) ** 2; }
  return sst ? 1 - sse / sst : 0;
}

export function corr(a: number[], b: number[]): number {
  const ma = avg(a), mb = avg(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { const x = (a[i] as number) - ma, y = (b[i] as number) - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export interface Backtest { gross: number[]; net: number[]; cumGross: number[]; cumNet: number[]; turnover: number; sharpeGross: number; sharpeNet: number; hitRate: number }

/** Position_t = sign(prediction_t) ∈ {−1, +1}; P&L_t = position_t · y_t; cost = bps × |Δposition|. */
export function backtest(pred: number[], y: number[], costBps: number): Backtest {
  const pos = pred.map((p) => (p >= 0 ? 1 : -1));
  const gross = pos.map((p, i) => p * (y[i] as number));
  let prev = 0, turn = 0;
  const net = gross.map((g, i) => { const dp = Math.abs((pos[i] as number) - prev); prev = pos[i] as number; turn += dp; return g - (dp * costBps) / 10000; });
  const cum = (xs: number[]) => { let c = 0; return xs.map((x) => (c += x)); };
  const sharpe = (xs: number[]) => { const m = avg(xs); const sd = Math.sqrt(avg(xs.map((x) => (x - m) ** 2))); return sd ? (m / sd) * Math.sqrt(252) : 0; };
  const hits = gross.filter((g) => g > 0).length;
  return { gross, net, cumGross: cum(gross), cumNet: cum(net), turnover: turn / Math.max(1, pos.length), sharpeGross: sharpe(gross), sharpeNet: sharpe(net), hitRate: hits / Math.max(1, gross.length) };
}

/** Pick the noise feature with the best in-sample |t|: classic data-mining selection. */
export function bestOfNoise(ds: Dataset, trainEnd: number) {
  let best = { name: "", t: 0 };
  for (let k = 1; k <= 20; k++) {
    const name = `noise_${k}`;
    const f = ols((ds.features[name] as number[]).slice(0, trainEnd), ds.returns.slice(0, trainEnd));
    if (Math.abs(f.tStat) > Math.abs(best.t)) best = { name, t: f.tStat };
  }
  return best;
}

/** Leakage diagnostic: correlation of the feature with the contemporaneous-day return r_t vs next-day target r_{t+1}. */
export function leakDiagnostic(ds: Dataset, name: string) {
  const f = ds.features[name] as number[];
  const yNext = ds.returns;
  const sameDay = [0, ...ds.returns.slice(0, -1)];
  const twoAhead = [...ds.returns.slice(1), 0];
  return { corrNext: corr(f, yNext), corrSameDay: corr(f, sameDay), corrTwoAhead: corr(f, twoAhead) };
}
