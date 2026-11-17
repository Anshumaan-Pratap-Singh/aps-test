"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV } from "@/lib/nav";
import { AccountChip } from "./AccountChip";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-bg sticky top-0 h-screen" aria-label="Primary">
      <Link href="/" className="px-5 py-5 flex items-baseline gap-2">
        <span className="font-mono text-xl font-bold tracking-widest text-cyan">APS</span>
        <span className="text-[11px] uppercase tracking-wider text-muted">quant training terminal</span>
      </Link>
      <nav className="flex-1 px-2">
        <ul className="space-y-0.5">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    active ? "bg-elevated text-cyan border-l-2 border-cyan" : "text-muted hover:text-text hover:bg-surface border-l-2 border-transparent"
                  }`}
                >
                  <span aria-hidden className="w-4 text-center font-mono">{n.icon}</span>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-3 border-t border-border"><AccountChip /></div>
    </aside>
  );
}

/** Mobile: a flat, horizontally scrollable top strip. No hamburger, no nesting. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="lg:hidden sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 pt-3">
        <Link href="/" className="font-mono font-bold tracking-widest text-cyan">APS</Link>
        <div className="ml-auto"><AccountChip compact /></div>
      </div>
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 no-scrollbar">
        {NAV.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <li key={n.href} className="shrink-0">
              <Link href={n.href} aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm ${active ? "bg-elevated text-cyan" : "text-muted"}`}>
                {n.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
