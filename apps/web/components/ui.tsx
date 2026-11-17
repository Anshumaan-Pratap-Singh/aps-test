import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      {kicker && <p className="text-xs uppercase tracking-[0.18em] text-blue mb-1">{kicker}</p>}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="mt-2 max-w-3xl text-muted text-sm leading-relaxed">{children}</div>}
    </header>
  );
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <Tag className={`rounded-lg border border-border bg-surface p-4 ${className}`}>{children}</Tag>;
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 mt-8 first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">{children}</h2>
      {aside}
    </div>
  );
}

export function Difficulty({ level, max = 10 }: { level: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Difficulty ${level} of ${max}`} title={`Difficulty ${level}/${max}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-1.5 w-3 rounded-sm ${i < Math.ceil((level / max) * 5) ? "bg-cyan" : "bg-border"}`} />
      ))}
    </span>
  );
}

export type Status = "operational" | "partial" | "planned";

export function StatusBadge({ status }: { status: Status }) {
  const map = {
    operational: "text-teal border-teal/40",
    partial: "text-blue border-blue/50",
    planned: "text-muted border-border",
  } as const;
  const label = { operational: "Operational", partial: "Partial", planned: "Planned" }[status];
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${map[status]}`}>{label}</span>;
}

export function ModuleCard({ href, title, description, difficulty, status = "operational", meta, progress }: {
  href?: string; title: string; description: string; difficulty?: number; status?: Status; meta?: ReactNode; progress?: number | null;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-text group-hover:text-cyan transition-colors">{title}</h3>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1.5 text-sm text-muted leading-relaxed flex-1">{description}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        {difficulty ? <Difficulty level={difficulty} /> : <span />}
        <span className="font-mono num">{meta}</span>
      </div>
      {progress != null && (
        <div className="mt-2 h-1 rounded bg-border overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-teal" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
    </>
  );
  const cls = "group flex flex-col rounded-lg border border-border bg-surface p-4 min-h-36";
  if (!href || status === "planned") return <div className={`${cls} opacity-70`} aria-disabled={status === "planned"}>{body}</div>;
  return <Link href={href} className={`${cls} hover:border-cyan/60 hover:bg-elevated transition-colors`}>{body}</Link>;
}

export function Stat({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "bad" | "accent" }) {
  const color = { default: "text-text", good: "text-teal", bad: "text-error", accent: "text-cyan" }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 font-mono num text-lg ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", type = "button", disabled, className = "", ...rest }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; type?: "button" | "submit"; disabled?: boolean; className?: string;
} & Record<`data-${string}` | `aria-${string}`, string | undefined>) {
  const styles = {
    primary: "bg-cyan text-bg hover:bg-teal font-semibold",
    ghost: "border border-border text-text hover:border-cyan/60 hover:text-cyan",
    danger: "border border-error/60 text-error hover:bg-error/10",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-md px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div role="note" className={`rounded-md border px-3 py-2 text-sm ${tone === "warn" ? "border-error/50 text-error/90 bg-error/5" : "border-blue/40 text-muted bg-blue/5"}`}>
      {children}
    </div>
  );
}
