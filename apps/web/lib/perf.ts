/**
 * Client performance instrumentation. Records *measured* values only:
 *  - processing: JS time to grade an answer and prepare the next question (performance.now deltas)
 *  - inputToPaint: keydown timestamp → first animation frame after the React commit
 *    (rAF + MessageChannel post approximates "next paint")
 *  - eventTiming: browser Event Timing API durations (INP proxy) where supported
 * Samples live in a bounded ring buffer and are mirrored to localStorage for the
 * diagnostics panel. Nothing here touches the network.
 */
type Metric = "processing" | "inputToPaint" | "eventTiming";

const MAX = 2000;
const buf: Record<Metric, number[]> = { processing: [], inputToPaint: [], eventTiming: [] };
let observerInstalled = false;
const errors: { message: string; at: number }[] = [];

export function record(metric: Metric, ms: number) {
  const arr = buf[metric];
  arr.push(ms);
  if (arr.length > MAX) arr.shift();
  schedulePersist();
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let loaded = false;
/** Debounced, off the hot path; also flushed on pagehide. */
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => { persistTimer = null; persist(); }, 500);
}

function persist() {
  if (!loaded) loadSamples(); // merge earlier pages' samples before overwriting
  try { localStorage.setItem("aps-perf", JSON.stringify(buf)); } catch { /* quota/private mode */ }
}

export function loadSamples(): Record<Metric, number[]> {
  if (!loaded) {
    loaded = true;
    try {
      const raw = localStorage.getItem("aps-perf");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<Metric, number[]>;
        for (const k of Object.keys(buf) as Metric[]) buf[k] = [...(parsed[k] ?? []), ...buf[k]].slice(-MAX);
      }
    } catch { /* ignore */ }
  }
  return buf;
}

export function clearSamples() {
  loaded = true;
  for (const k of Object.keys(buf) as Metric[]) buf[k] = [];
  try { localStorage.removeItem("aps-perf"); } catch { /* ignore */ }
}

/** Call right after the state update that shows the next question. */
export function measureNextPaint(inputTs: number) {
  if (typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => record("inputToPaint", performance.now() - inputTs);
    ch.port2.postMessage(0);
  });
}

export function installEventTiming() {
  if (observerInstalled || typeof PerformanceObserver === "undefined") return;
  if (!PerformanceObserver.supportedEntryTypes?.includes("event")) return;
  observerInstalled = true;
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const ev = e as PerformanceEventTiming & { interactionId?: number };
      if (ev.interactionId) record("eventTiming", ev.duration);
    }
  });
  po.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
}

export function installErrorReporting() {
  if (typeof window === "undefined") return;
  installEventTiming();
  window.addEventListener("pagehide", () => { if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; } persist(); });
  window.addEventListener("error", (e) => { errors.push({ message: String(e.message), at: Date.now() }); });
  window.addEventListener("unhandledrejection", (e) => { errors.push({ message: String(e.reason), at: Date.now() }); });
}

export function recentErrors() {
  return errors.slice(-50);
}
