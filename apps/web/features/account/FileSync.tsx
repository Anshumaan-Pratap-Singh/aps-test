"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { exportToFile, getGistSettings, importFromFile, onGistStatus, saveGistSettings, syncNow, type GistSettings } from "@/lib/fileSync";

function ago(t?: number) {
  if (!t) return "never";
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString();
}

export function FileSync() {
  const [settings, setSettings] = useState<GistSettings | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(getGistSettings());
    return onGistStatus(() => setSettings(getGistSettings()));
  }, []);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setMsg(null);
    try { setMsg(await fn()); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const connect = () => run(async () => {
    const t = token.trim();
    if (!t) return "Paste a token first.";
    saveGistSettings({ token: t });
    setToken("");
    try { await syncNow(); } catch (e) { saveGistSettings(null); throw e; }
    return "Connected. Progress now syncs automatically.";
  });

  const onFile = (f: File | undefined) => f && run(async () => {
    const n = await importFromFile(f);
    if (fileRef.current) fileRef.current.value = "";
    if (getGistSettings()) await syncNow().catch(() => {});
    return `Imported ${n} new or updated record(s). Reload pages to see them.`;
  });

  return (
    <>
      <Card className="space-y-3">
        <h2 className="font-semibold">Auto-sync (private GitHub Gist)</h2>
        {settings ? (
          <>
            <p className="text-sm">Connected{settings.gistId ? <> · <a className="text-cyan" href={`https://gist.github.com/${settings.gistId}`} target="_blank" rel="noreferrer">view Gist</a></> : null} · last sync {ago(settings.lastSyncAt)}</p>
            {settings.lastError && <Notice tone="warn">Last sync failed: {settings.lastError}</Notice>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => run(async () => { await syncNow(); return "Synced."; })}>{busy ? "Syncing…" : "Sync now"}</Button>
              <Button variant="ghost" onClick={() => { saveGistSettings(null); setMsg("Disconnected. The token was removed from this browser; your Gist is untouched."); }}>Disconnect</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Create a <strong>classic</strong> token at{" "}
              <a className="text-cyan" href="https://github.com/settings/tokens/new?scopes=gist&description=APS%20sync" target="_blank" rel="noreferrer">github.com/settings/tokens</a>{" "}
              with <strong>only the &quot;gist&quot; scope</strong>, then paste it here. Do this once on each device. The token is stored only in this browser.
            </p>
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void connect(); }}>
              <input type="password" autoComplete="off" placeholder="ghp_…" value={token} onChange={(e) => setToken(e.target.value)} className="flex-1 min-w-48 rounded-md border border-border bg-bg px-3 py-2 text-sm" aria-label="GitHub token" />
              <Button type="submit" disabled={busy}>{busy ? "Connecting…" : "Connect"}</Button>
            </form>
          </>
        )}
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Backup file</h2>
        <p className="text-sm text-muted">Download everything as <code>aps-progress.json</code>, or load a file from another device. Importing merges and never deletes.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => void exportToFile()}>Export progress</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>Import progress…</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </Card>
      {msg && <Notice>{msg}</Notice>}
    </>
  );
}
