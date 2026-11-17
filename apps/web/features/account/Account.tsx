"use client";

import { useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { api, ApiError, UserSchema } from "@/lib/api";
import { db } from "@/lib/db";
import { drain } from "@/lib/sync";
import { useAuth } from "@/stores/app";

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Account() {
  const { user, setUser, status } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", display_name: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      const u = await api(`/auth/${mode}`, { method: "POST", json: body }, UserSchema);
      setUser(u);
      const r = await drain();
      setMsg(`Signed in. Synced ${r.sent} queued item(s).`);
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.status === 422 ? "Check the form: valid email and a password of at least 10 characters." : e.message) : "Server unreachable.");
    } finally { setBusy(false); }
  };

  const exportLocal = async () => download("aps-local-export.json", { sessions: await db.allSessions(), games: await db.allGames(), lessons: await db.allLessons() });
  const exportServer = async () => { try { download("aps-account-export.json", await api("/users/me/export")); } catch { setMsg("Server export failed."); } };
  const clearLocal = async () => {
    for (const name of ["aps-sessions", "aps-games", "aps-lessons", "aps-outbox", "aps-cache"]) indexedDB.deleteDatabase(name);
    try { localStorage.removeItem("aps-prefs"); localStorage.removeItem("aps-perf"); } catch { /* ignore */ }
    setMsg("Local data cleared. Reload the page.");
  };

  if (user) {
    return (
      <div className="space-y-4">
        <Card className="space-y-2">
          <p>Signed in as <strong>{user.display_name}</strong> <span className="text-muted">({user.email})</span></p>
          <Button variant="ghost" onClick={async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); setUser(null); }}>Sign out</Button>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">Your data</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportServer}>Export account data (JSON)</Button>
            <Button variant="ghost" onClick={exportLocal}>Export this device&apos;s data</Button>
          </div>
          {!confirmDelete ? <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete account…</Button> : (
            <div className="space-y-2">
              <Notice tone="warn">This permanently deletes your account and every synced session, attempt, game and skill record on the server. It cannot be undone. Local data on this device is not affected.</Notice>
              <div className="flex gap-2">
                <Button variant="danger" onClick={async () => { await api("/users/me", { method: "DELETE" }); setUser(null); setMsg("Account deleted."); }}>Permanently delete</Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
        {msg && <Notice>{msg}</Notice>}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md">
      <Notice>APS works fully offline without an account; your history stays on this device. An account syncs history across devices and unlocks server-validated assessments and cohort benchmarks.{status === "offline" ? " The backend is currently unreachable." : ""}</Notice>
      <Card className="space-y-3">
        <div className="flex gap-2" role="tablist">{(["login", "register"] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md border px-3 py-1 text-sm ${mode === m ? "border-cyan text-cyan" : "border-border text-muted"}`}>{m === "login" ? "Sign in" : "Create account"}</button>)}</div>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {mode === "register" && <label className="block text-sm">Display name<input required maxLength={80} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="mt-1 block w-full rounded-md border border-border bg-bg px-3 py-2" data-testid="name" /></label>}
          <label className="block text-sm">Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 block w-full rounded-md border border-border bg-bg px-3 py-2" data-testid="email" /></label>
          <label className="block text-sm">Password<input type="password" required minLength={mode === "register" ? 10 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 block w-full rounded-md border border-border bg-bg px-3 py-2" data-testid="password" /></label>
          <Button type="submit" disabled={busy} data-testid="auth-submit">{busy ? "…" : mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
        {msg && <p className="text-sm text-muted" data-testid="auth-msg">{msg}</p>}
      </Card>
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold">This device</h2>
        <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={exportLocal}>Export local data</Button><Button variant="danger" onClick={clearLocal}>Clear local data</Button></div>
      </Card>
    </div>
  );
}
