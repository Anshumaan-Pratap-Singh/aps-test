import katex from "katex";
import { memo } from "react";

/**
 * Safe KaTeX rendering. `trust: false` blocks \href, \url, \includegraphics and
 * HTML-injecting commands; `maxExpand`/`maxSize` bound macro bombs. Invalid LaTeX
 * renders as an inline error rather than throwing. Output includes MathML for
 * screen readers. Works in Server and Client Components (pure function).
 */
const cache = new Map<string, string>();

export function renderTex(tex: string, display = false): string {
  const key = `${display ? "D" : "I"}${tex}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let html: string;
  try {
    html = katex.renderToString(tex, {
      displayMode: display, throwOnError: true, trust: false, strict: "ignore", output: "htmlAndMathml", maxExpand: 500, maxSize: 20,
    });
  } catch {
    const esc = tex.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
    html = `<span class="math-error" role="img" aria-label="invalid expression">${esc}</span>`;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, html);
  return html;
}

export const M = memo(function M({ children, display = false, className }: { children: string; display?: boolean; className?: string }) {
  return (
    <span
      className={className}
      // KaTeX output is generated from our own source with trust:false; never pass user HTML here.
      dangerouslySetInnerHTML={{ __html: renderTex(children, display) }}
    />
  );
});

export function MD({ children }: { children: string }) {
  return <div className="my-3"><M display>{children}</M></div>;
}

/** Render text containing inline $...$ math segments (no HTML is interpreted). */
export function TexText({ children, className }: { children: string; className?: string }) {
  const parts = children.split(/(\$[^$]+\$)/g);
  return (
    <span className={className}>
      {parts.map((p, i) => (p.startsWith("$") && p.endsWith("$") && p.length > 2 ? <M key={i}>{p.slice(1, -1)}</M> : <span key={i}>{p}</span>))}
    </span>
  );
}
