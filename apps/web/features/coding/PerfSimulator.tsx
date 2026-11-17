"use client";

import { useState } from "react";
import { BarChart } from "@/components/charts";
import { Button, Card, Notice } from "@/components/ui";
import { percentile } from "@/lib/stats";
import { Rng } from "@/lib/rng";

/**
 * Real micro-benchmarks executed in your browser's JavaScript engine. They illustrate
 * the same hardware effects discussed for C++ (cache locality, branch prediction,
 * allocation), but absolute numbers reflect JS JIT + your machine, not native code.
 * Method: W warm-up runs discarded, then S timed samples; we report p50/p95/p99/max.
 */
interface Impl { name: string; setup: (n: number) => () => number }
interface Experiment { id: string; title: string; lesson: string; sizes: number[]; impls: Impl[] }

let sink = 0; // defeats dead-code elimination

const EXPERIMENTS: Experiment[] = [
  {
    id: "locality", title: "Sequential vs random memory access", lesson: "Contiguous traversal lets the prefetcher stream cache lines; a random permutation defeats it once the array exceeds the caches.",
    sizes: [1 << 12, 1 << 16, 1 << 20, 1 << 22],
    impls: [
      { name: "sequential", setup: (n) => { const a = new Int32Array(n).map((_, i) => i); return () => { let s = 0; for (let i = 0; i < n; i++) s += a[i]!; return s; }; } },
      { name: "random order", setup: (n) => { const a = new Int32Array(n).map((_, i) => i); const idx = new Int32Array(new Rng("perm").shuffle(Array.from({ length: n }, (_, i) => i))); return () => { let s = 0; for (let i = 0; i < n; i++) s += a[idx[i]!]!; return s; }; } },
    ],
  },
  {
    id: "soa", title: "Array-of-structs vs struct-of-arrays", lesson: "Summing one field over objects drags whole objects through the cache; a packed Float64Array uses every byte fetched.",
    sizes: [1 << 14, 1 << 18, 1 << 20],
    impls: [
      { name: "AoS (objects)", setup: (n) => { const a = Array.from({ length: n }, (_, i) => ({ id: i, price: i * 0.5, qty: i % 7, side: i & 1, ts: i * 3 })); return () => { let s = 0; for (let i = 0; i < n; i++) s += a[i]!.price; return s; }; } },
      { name: "SoA (Float64Array)", setup: (n) => { const p = new Float64Array(n).map((_, i) => i * 0.5); return () => { let s = 0; for (let i = 0; i < n; i++) s += p[i]!; return s; }; } },
    ],
  },
  {
    id: "branch", title: "Branch prediction: sorted vs random data", lesson: "A data-dependent branch on random input mispredicts ~50% of the time; sorting makes it predictable. (JIT may emit branchless code, shrinking the gap.)",
    sizes: [1 << 16, 1 << 20],
    impls: [
      { name: "random", setup: (n) => { const r = new Rng("br"); const a = new Int32Array(n).map(() => r.int(0, 255)); return () => { let s = 0; for (let i = 0; i < n; i++) if (a[i]! >= 128) s += a[i]!; return s; }; } },
      { name: "sorted", setup: (n) => { const r = new Rng("br"); const a = new Int32Array(n).map(() => r.int(0, 255)).sort(); return () => { let s = 0; for (let i = 0; i < n; i++) if (a[i]! >= 128) s += a[i]!; return s; }; } },
    ],
  },
  {
    id: "alloc", title: "Allocate per message vs reuse a buffer", lesson: "Allocating in the hot path costs allocator time and GC pauses, which show up in the tail (p99/max) more than the median.",
    sizes: [1 << 12, 1 << 15],
    impls: [
      { name: "allocate", setup: (n) => () => { let s = 0; for (let i = 0; i < n; i++) { const m = { px: i, qty: 1, side: i & 1, buf: new Uint8Array(32) }; s += m.px + m.buf.length; } return s; } },
      { name: "reuse", setup: (n) => { const m = { px: 0, qty: 1, side: 0, buf: new Uint8Array(32) }; return () => { let s = 0; for (let i = 0; i < n; i++) { m.px = i; m.side = i & 1; s += m.px + m.buf.length; } return s; }; } },
    ],
  },
];

interface Row { impl: string; size: number; p50: number; p95: number; p99: number; max: number; nsPerOp: number }

async function bench(fn: () => number, warm: number, samples: number): Promise<number[]> {
  for (let i = 0; i < warm; i++) sink ^= fn();
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = performance.now(); sink ^= fn(); out.push(performance.now() - t);
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
  }
  return out;
}

export function PerfSimulator() {
  const [exp, setExp] = useState(EXPERIMENTS[0]!);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [warm, setWarm] = useState(5);

  const run = async () => {
    setBusy(true); setRows([]);
    const out: Row[] = [];
    for (const size of exp.sizes) for (const impl of exp.impls) {
      const fn = impl.setup(size);
      const s = await bench(fn, warm, 25);
      const p50 = percentile(s, 0.5)!;
      out.push({ impl: impl.name, size, p50, p95: percentile(s, 0.95)!, p99: percentile(s, 0.99)!, max: Math.max(...s), nsPerOp: (p50 * 1e6) / size });
      setRows([...out]);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Notice>These are real measurements in your browser (JavaScript JIT), with warm-up runs discarded and 25 samples per cell. Timer resolution is coarsened by browsers (often 5–100 µs), so each sample times a whole loop. Results vary with load, power settings and browser; re-run to see the variance.</Notice>
      <div className="flex flex-wrap gap-2">
        {EXPERIMENTS.map((e) => <button key={e.id} onClick={() => { setExp(e); setRows([]); }} aria-pressed={exp.id === e.id} className={`rounded-md border px-3 py-1.5 text-sm ${exp.id === e.id ? "border-cyan text-cyan bg-elevated" : "border-border text-muted"}`}>{e.title}</button>)}
      </div>
      <Card className="space-y-3">
        <p className="text-sm text-muted">{exp.lesson}</p>
        <label className="text-sm">Warm-up runs discarded: <input type="number" min={0} max={50} value={warm} onChange={(e) => setWarm(Number(e.target.value))} className="ml-1 w-16 rounded border border-border bg-bg px-2 py-0.5 font-mono" /></label>
        <div><Button onClick={run} disabled={busy} data-testid="run-bench">{busy ? "Measuring…" : "Run benchmark"}</Button></div>
        {rows.length > 0 && (
          <>
            <table className="w-full text-sm" data-testid="bench-results">
              <thead className="text-xs text-muted text-left"><tr><th>Implementation</th><th>N</th><th>p50</th><th>p95</th><th>p99</th><th>max</th><th>ns / element (p50)</th></tr></thead>
              <tbody className="font-mono num">{rows.map((r) => <tr key={`${r.impl}-${r.size}`} className="border-t border-border"><td className="font-sans">{r.impl}</td><td>{r.size.toLocaleString()}</td><td>{r.p50.toFixed(3)}ms</td><td>{r.p95.toFixed(3)}ms</td><td>{r.p99.toFixed(3)}ms</td><td>{r.max.toFixed(3)}ms</td><td className="text-cyan">{r.nsPerOp.toFixed(2)}</td></tr>)}</tbody>
            </table>
            <BarChart ariaLabel="Nanoseconds per element at median" bars={rows.map((r) => ({ label: `${r.impl.slice(0, 8)} ${r.size >= 1 << 20 ? `${r.size >> 20}M` : `${r.size >> 10}K`}`, value: Number(r.nsPerOp.toFixed(2)), color: r.impl === exp.impls[0]!.name ? "#3185D8" : "#00F5D4" }))} format={(v) => v.toFixed(2)} />
          </>
        )}
      </Card>
      <span hidden>{sink}</span>
    </div>
  );
}
