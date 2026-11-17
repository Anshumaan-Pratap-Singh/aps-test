import { describe, expect, it } from "vitest";
import { backtest, leakDiagnostic, makeDataset, ols, oosR2 } from "@/features/research/lab";

describe("research lab", () => {
  it("OLS recovers a known line", () => {
    const x = Array.from({ length: 50 }, (_, i) => i);
    const f = ols(x, x.map((v) => 3 + 2 * v));
    expect(f.slope).toBeCloseTo(2, 10);
    expect(f.intercept).toBeCloseTo(3, 10);
    expect(f.r2).toBeCloseTo(1, 10);
  });

  it("legitimate signal generalises; leaky feature is flagged by diagnostics", () => {
    const ds = makeDataset(7);
    const te = 600;
    const fit = ols(ds.features.signal_obs!.slice(0, te), ds.returns.slice(0, te));
    expect(fit.slope).toBeGreaterThan(0);
    const pred = ds.features.signal_obs!.slice(te).map((v) => fit.intercept + fit.slope * v);
    const mean = ds.returns.slice(0, te).reduce((a, b) => a + b, 0) / te;
    expect(oosR2(pred, ds.returns.slice(te), mean)).toBeGreaterThan(0);
    const leak = leakDiagnostic(ds, "centred_ma");
    expect(Math.abs(leak.corrTwoAhead)).toBeGreaterThan(0.2);
    expect(Math.abs(leakDiagnostic(ds, "signal_obs").corrTwoAhead)).toBeLessThan(Math.abs(leak.corrTwoAhead));
  });

  it("costs reduce net returns by exactly turnover × bps", () => {
    const y = [0.01, -0.02, 0.03, 0.01];
    const b = backtest([1, -1, 1, 1], y, 10);
    const totalTurn = 1 + 2 + 2 + 0;
    expect((b.cumGross.at(-1)! - b.cumNet.at(-1)!) * 10000).toBeCloseTo(totalTurn * 10, 8);
  });
});
