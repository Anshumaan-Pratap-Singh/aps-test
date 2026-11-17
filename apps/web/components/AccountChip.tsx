"use client";

import Link from "next/link";
import { useAuth } from "@/stores/app";

export function AccountChip({ compact = false }: { compact?: boolean }) {
  const { user, status } = useAuth();
  const label = user ? user.display_name : status === "offline" ? "Offline · local only" : "Sign in to sync";
  return (
    <Link href="/account" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:text-text hover:bg-surface">
      <span aria-hidden className={`h-2 w-2 rounded-full ${user ? "bg-teal" : status === "offline" ? "bg-error" : "bg-muted"}`} />
      {!compact && <span className="truncate">{label}</span>}
      {compact && <span className="sr-only">{label}</span>}
    </Link>
  );
}
