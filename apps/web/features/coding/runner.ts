"use client";

import type { TestCase } from "./problems";

export interface RunResult {
  ok: boolean;
  compileError?: string | null;
  error?: string;
  results: { name: string; passed: boolean; hidden: boolean; error?: string; ms: number }[];
  stdout?: string;
  timedOut?: boolean;
  wallMs: number;
}

let worker: Worker | null = null;
let seq = 0;
let loaded = false;

function getWorker(): Worker {
  if (!worker) worker = new Worker("/py-worker.js");
  return worker;
}

/**
 * Run Python in a dedicated Web Worker (Pyodide). The browser sandbox isolates it from
 * the host; we enforce a wall-clock limit by terminating the worker, which also kills
 * infinite loops. Nothing is sent to the server.
 */
export function runPython(code: string, tests: TestCase[], timeLimitMs: number, warmupMs = 30_000): Promise<RunResult> {
  const w = getWorker();
  const id = ++seq;
  const t0 = performance.now();
  return new Promise((resolve) => {
    const wasLoaded = loaded;
    const limit = window.setTimeout(() => {
      w.terminate(); worker = null; loaded = false;
      resolve({ ok: false, timedOut: true, results: [], error: wasLoaded ? `Time limit exceeded (${timeLimitMs} ms)` : `Time limit exceeded, or the Python runtime did not load within ${Math.round(warmupMs / 1000)} s`, wallMs: performance.now() - t0 });
    }, timeLimitMs + (loaded ? 0 : warmupMs));
    const onMsg = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      loaded = true;
      clearTimeout(limit);
      w.removeEventListener("message", onMsg);
      const d = e.data;
      resolve({ ok: !!d.ok, compileError: d.compile_error ?? null, error: d.error, results: d.results ?? [], stdout: d.stdout, wallMs: performance.now() - t0 });
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ id, code, tests });
  });
}

export function resetRunner() {
  worker?.terminate();
  worker = null;
}
