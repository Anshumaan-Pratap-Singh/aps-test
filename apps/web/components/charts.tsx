/**
 * Minimal dependency-free SVG charts. They plot exactly the data passed in.
 */
export interface Series { label: string; color: string; points: { x: number; y: number }[]; dashed?: boolean }

function extent(vals: number[], pad = 0.05): [number, number] {
  if (!vals.length) return [0, 1];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

function ticks(lo: number, hi: number, n = 4): number[] {
  const step = (hi - lo) / n;
  return Array.from({ length: n + 1 }, (_, i) => lo + i * step);
}

const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : v.toFixed(Math.abs(v) < 10 ? 1 : 0));

export function LineChart({ series, height = 200, xLabel, yLabel, xFormat, yDomain, zeroLine, ariaLabel, verticalMarkers = [] }: {
  series: Series[]; height?: number; xLabel?: string; yLabel?: string; xFormat?: (x: number) => string; yDomain?: [number, number];
  zeroLine?: boolean; ariaLabel: string; verticalMarkers?: { x: number; label: string }[];
}) {
  const W = 640, H = height, L = 44, R = 10, T = 10, B = 28;
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  const [x0, x1] = extent(xs, 0);
  const [y0, y1] = yDomain ?? extent(ys);
  const sx = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
  if (!xs.length) return <div className="text-sm text-muted py-8 text-center">No data yet.</div>;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
        {ticks(y0, y1).map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke="#1E3A5F" strokeWidth={0.5} />
            <text x={L - 6} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="#8FA3BA" className="num">{fmt(t)}</text></g>
        ))}
        {zeroLine && y0 < 0 && y1 > 0 && <line x1={L} x2={W - R} y1={sy(0)} y2={sy(0)} stroke="#8FA3BA" strokeWidth={0.8} />}
        {ticks(x0, x1).map((t) => <text key={t} x={sx(t)} y={H - 10} textAnchor="middle" fontSize={10} fill="#8FA3BA">{xFormat ? xFormat(t) : fmt(t)}</text>)}
        {verticalMarkers.map((m) => (
          <g key={m.label}><line x1={sx(m.x)} x2={sx(m.x)} y1={T} y2={H - B} stroke="#3185D8" strokeDasharray="4 3" />
            <text x={sx(m.x) + 4} y={T + 10} fontSize={10} fill="#3185D8">{m.label}</text></g>
        ))}
        {series.map((s) => (
          <polyline key={s.label} fill="none" stroke={s.color} strokeWidth={1.6} strokeDasharray={s.dashed ? "5 4" : undefined}
            points={s.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ")} />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-3 text-xs text-muted mt-1">
        {series.map((s) => <span key={s.label} className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: s.color }} />{s.label}</span>)}
        {yLabel && <span className="ml-auto">y: {yLabel}</span>}{xLabel && <span>x: {xLabel}</span>}
      </figcaption>
    </figure>
  );
}

export function ScatterPlot({ points, line, height = 240, xLabel, yLabel, ariaLabel, color = "#00E5FF" }: {
  points: { x: number; y: number }[]; line?: { slope: number; intercept: number }; height?: number; xLabel: string; yLabel: string; ariaLabel: string; color?: string;
}) {
  const W = 480, H = height, L = 44, R = 10, T = 10, B = 30;
  const [x0, x1] = extent(points.map((p) => p.x));
  const [y0, y1] = extent(points.map((p) => p.y));
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const clampY = (y: number) => Math.max(T, Math.min(H - B, y));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
        {ticks(y0, y1).map((t) => <g key={`y${t}`}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke="#1E3A5F" strokeWidth={0.5} /><text x={L - 6} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="#8FA3BA">{fmt(t)}</text></g>)}
        {ticks(x0, x1).map((t) => <text key={`x${t}`} x={sx(t)} y={H - 12} textAnchor="middle" fontSize={10} fill="#8FA3BA">{fmt(t)}</text>)}
        {points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={1.8} fill={color} fillOpacity={0.55} />)}
        {line && <line x1={sx(x0)} y1={clampY(sy(line.intercept + line.slope * x0))} x2={sx(x1)} y2={clampY(sy(line.intercept + line.slope * x1))} stroke="#00F5D4" strokeWidth={1.8} />}
      </svg>
      <figcaption className="flex justify-between text-xs text-muted"><span>x: {xLabel}</span><span>y: {yLabel}</span></figcaption>
    </figure>
  );
}

export function BarChart({ bars, height = 160, ariaLabel, format = (v: number) => String(v) }: {
  bars: { label: string; value: number; color?: string }[]; height?: number; ariaLabel: string; format?: (v: number) => string;
}) {
  const W = 640, H = height, B = 26, T = 14;
  const max = Math.max(1e-9, ...bars.map((b) => Math.abs(b.value)));
  const bw = (W / Math.max(1, bars.length)) * 0.7;
  if (!bars.length) return <div className="text-sm text-muted py-8 text-center">No data yet.</div>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
      {bars.map((b, i) => {
        const x = (i + 0.15) * (W / bars.length);
        const h = (Math.abs(b.value) / max) * (H - B - T);
        return (
          <g key={b.label}>
            <rect x={x} y={H - B - h} width={bw} height={h} fill={b.color ?? "#3185D8"} rx={2} />
            <text x={x + bw / 2} y={H - B - h - 3} textAnchor="middle" fontSize={10} fill="#EAF4FF" className="num">{format(b.value)}</text>
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#8FA3BA">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
