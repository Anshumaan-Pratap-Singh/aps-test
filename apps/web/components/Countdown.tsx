"use client";

import { useEffect, useRef } from "react";
import { fmtClock } from "@/lib/stats";

/**
 * Timer display driven by requestAnimationFrame. It reads time from the engine
 * (computed from the start timestamp) and writes text directly to the DOM node,
 * so the parent console never re-renders per frame.
 */
export function Countdown({ getRemaining, getElapsed, onExpire, running }: {
  getRemaining: () => number | null; getElapsed: () => number; onExpire: () => void; running: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const expired = useRef(false);
  useEffect(() => {
    expired.current = false;
    if (!running) return;
    let raf = 0;
    let lastText = "";
    const tick = () => {
      const rem = getRemaining();
      const text = rem == null ? fmtClock(getElapsed() + 999) : fmtClock(rem);
      if (ref.current && text !== lastText) { ref.current.textContent = text; lastText = text; }
      if (rem != null && rem <= 0 && !expired.current) { expired.current = true; onExpire(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Background tabs throttle rAF; a coarse timeout guarantees expiry is still detected.
    const rem0 = getRemaining();
    const to = rem0 != null ? window.setTimeout(() => { if (!expired.current) { expired.current = true; onExpire(); } }, rem0 + 50) : 0;
    return () => { cancelAnimationFrame(raf); if (to) clearTimeout(to); };
  }, [running, getRemaining, getElapsed, onExpire]);
  return <span ref={ref} className="font-mono num" aria-live="off" role="timer">{fmtClock(getRemaining() ?? 0)}</span>;
}
