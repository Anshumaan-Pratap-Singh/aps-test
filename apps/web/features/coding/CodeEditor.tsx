"use client";

import { useMemo, useRef, type KeyboardEvent } from "react";

const KW = new Set("def class return if elif else for while in not and or is None True False import from as with try except finally raise pass break continue lambda yield global nonlocal assert del".split(" "));

/** Tokenise Python for highlighting. Produces escaped HTML spans (no user HTML is interpreted). */
function highlight(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
  let out = "", last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += `<span style="color:#8FA3BA">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span style="color:#00F5D4">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span style="color:#3185D8">${esc(m[3])}</span>`;
    else if (m[4]) out += KW.has(m[4]) ? `<span style="color:#00E5FF">${m[4]}</span>` : esc(m[4]);
    last = re.lastIndex;
  }
  return out + esc(src.slice(last)) + "\n";
}

/** Lightweight editor: a real <textarea> (accessible, mobile-friendly) over a highlighted <pre>. */
export function CodeEditor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const pre = useRef<HTMLPreElement>(null);
  const html = useMemo(() => highlight(value), [value]);
  const lines = value.split("\n").length;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = ta;
      onChange(value.slice(0, s) + "    " + value.slice(en));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 4; });
    } else if (e.key === "Enter") {
      const s = ta.selectionStart;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const indent = /^\s*/.exec(value.slice(lineStart, s))?.[0] ?? "";
      const extra = value.slice(lineStart, s).trimEnd().endsWith(":") ? "    " : "";
      e.preventDefault();
      onChange(value.slice(0, s) + "\n" + indent + extra + value.slice(ta.selectionEnd));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 1 + indent.length + extra.length; });
    }
  };

  const shared = "font-mono text-[13px] leading-5 p-3 pl-12 whitespace-pre m-0";
  return (
    <div className="relative rounded-md border border-border bg-[#08111f] overflow-hidden" style={{ height: `${Math.max(16, Math.min(32, lines + 2)) * 20 + 24}px` }}>
      <div aria-hidden className="absolute left-0 top-0 w-10 select-none border-r border-border py-3 text-right font-mono text-[13px] leading-5 text-muted/60">
        {Array.from({ length: lines }, (_, i) => <div key={i} className="pr-2">{i + 1}</div>)}
      </div>
      <pre ref={pre} aria-hidden className={`${shared} absolute inset-0 overflow-hidden pointer-events-none text-text`} dangerouslySetInnerHTML={{ __html: html }} />
      <textarea
        aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} spellCheck={false} autoCapitalize="off" autoCorrect="off"
        onScroll={(e) => { if (pre.current) { pre.current.scrollTop = e.currentTarget.scrollTop; pre.current.scrollLeft = e.currentTarget.scrollLeft; } }}
        className={`${shared} absolute inset-0 h-full w-full resize-none bg-transparent text-transparent caret-cyan outline-none overflow-auto`} data-testid="code-editor"
      />
    </div>
  );
}
