/**
 * Backend-free sync for the static (GitHub Pages) build.
 *
 * All progress lives in IndexedDB on each device. This module can:
 *  - export everything to a JSON snapshot file and import (merge) one back;
 *  - keep a single `aps-progress.json` file in a private GitHub Gist in sync across devices.
 *
 * Merging never deletes: records are matched by id and the "most progressed / newest" copy wins.
 * The Gist token is stored only in this browser's localStorage. It should be a classic token
 * with the `gist` scope only.
 */
import { db, onDataChange, type LessonProgress, type LocalGame, type LocalSession } from "./db";
import { usePrefs } from "@/stores/app";

export const SNAPSHOT_FILE = "aps-progress.json";
const SETTINGS_KEY = "aps-gist-sync";
const GH = "https://api.github.com";

export interface Snapshot {
  format: "aps-progress";
  version: 1;
  exportedAt: number;
  sessions: LocalSession[];
  games: LocalGame[];
  lessons: LessonProgress[];
  prefs: { levels: Record<string, number>; baselineDone: boolean };
}

export interface GistSettings {
  token: string;
  gistId?: string;
  lastSyncAt?: number;
  lastError?: string;
}

// ---------- snapshot / merge ----------

export async function buildSnapshot(): Promise<Snapshot> {
  const { levels, baselineDone } = usePrefs.getState();
  return {
    format: "aps-progress", version: 1, exportedAt: Date.now(),
    sessions: await db.allSessions(), games: await db.allGames(), lessons: await db.allLessons(),
    prefs: { levels, baselineDone },
  };
}

const sessionRank = (s: LocalSession) => [s.status === "completed" ? 2 : s.status === "abandoned" ? 1 : 0, s.attempts.length, s.durationMs, s.endedAt ?? 0];
const gameRank = (g: LocalGame) => [g.endedAt != null ? 1 : 0, g.events.length, g.endedAt ?? 0];
const lessonRank = (l: LessonProgress) => [l.updatedAt, l.status === "completed" ? 1 : 0, l.checksTotal];

function better(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Merge `incoming` into `base` by id; returns the merged list and the incoming records that won. */
function mergeById<T extends { id: string }>(base: T[], incoming: T[], rank: (x: T) => number[]) {
  const map = new Map(base.map((x) => [x.id, x]));
  const winners: T[] = [];
  for (const x of incoming) {
    const cur = map.get(x.id);
    if (!cur || better(rank(x), rank(cur))) { map.set(x.id, x); winners.push(x); }
  }
  return { merged: [...map.values()], winners };
}

function isSnapshot(x: unknown): x is Snapshot {
  const s = x as Snapshot;
  return !!s && typeof s === "object" && Array.isArray(s.sessions) && Array.isArray(s.games) && Array.isArray(s.lessons);
}

/** Merge a snapshot into this device. Returns how many records were added or updated. */
export async function applySnapshot(raw: unknown): Promise<number> {
  if (!isSnapshot(raw)) throw new Error("Not an APS progress file.");
  const local = await buildSnapshot();
  const s = mergeById(local.sessions, raw.sessions, sessionRank).winners;
  const g = mergeById(local.games, raw.games, gameRank).winners;
  const l = mergeById(local.lessons, raw.lessons, lessonRank).winners;
  if (s.length) await db.putSessions(s.map((x) => ({ ...x, synced: x.synced ?? false })));
  if (g.length) await db.putGames(g);
  if (l.length) await db.putLessons(l);
  if (raw.prefs) {
    const prefs = usePrefs.getState();
    // Keep this device's level where it has one; adopt levels it has never set.
    usePrefs.setState({
      levels: { ...(raw.prefs.levels ?? {}), ...prefs.levels },
      baselineDone: prefs.baselineDone || !!raw.prefs.baselineDone,
    });
  }
  return s.length + g.length + l.length;
}

// ---------- file export / import ----------

export async function exportToFile() {
  const snap = await buildSnapshot();
  const url = URL.createObjectURL(new Blob([JSON.stringify(snap)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = SNAPSHOT_FILE; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importFromFile(file: File): Promise<number> {
  return applySnapshot(JSON.parse(await file.text()));
}

// ---------- Gist sync ----------

export function getGistSettings(): GistSettings | null {
  try { const v = localStorage.getItem(SETTINGS_KEY); return v ? (JSON.parse(v) as GistSettings) : null; } catch { return null; }
}

export function saveGistSettings(v: GistSettings | null) {
  try { if (v) localStorage.setItem(SETTINGS_KEY, JSON.stringify(v)); else localStorage.removeItem(SETTINGS_KEY); } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn());
}

const listeners = new Set<() => void>();
export function onGistStatus(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (res.status === 401) throw new Error("GitHub rejected the token (expired or revoked).");
  if (res.status === 403 || res.status === 404) throw new Error(`GitHub refused the request (${res.status}). Check the token has the "gist" scope.`);
  if (!res.ok) throw new Error(`GitHub error ${res.status}.`);
  return (await res.json()) as T;
}

interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface Gist { id: string; files: Record<string, GistFile | undefined> }

async function findOrCreateGist(token: string): Promise<string> {
  for (let page = 1; page <= 5; page++) {
    const list = await gh<Gist[]>(token, `/gists?per_page=100&page=${page}`);
    const hit = list.find((g) => g.files[SNAPSHOT_FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  const created = await gh<Gist>(token, "/gists", {
    method: "POST",
    body: JSON.stringify({ description: "APS training progress (synced by the APS site)", public: false, files: { [SNAPSHOT_FILE]: { content: JSON.stringify(await buildSnapshot()) } } }),
  });
  return created.id;
}

let syncing: Promise<void> | null = null;
let pendingAgain = false;

/** Pull the Gist, merge into this device, then push the merged result back. */
export function syncNow(): Promise<void> {
  if (syncing) { pendingAgain = true; return syncing; }
  syncing = doSync().finally(() => {
    syncing = null;
    if (pendingAgain) { pendingAgain = false; void syncNow(); }
  });
  return syncing;
}

async function doSync() {
  const settings = getGistSettings();
  if (!settings?.token) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    const gistId = settings.gistId ?? (await findOrCreateGist(settings.token));
    const gist = await gh<Gist>(settings.token, `/gists/${gistId}`);
    const file = gist.files[SNAPSHOT_FILE];
    if (file) {
      let text = file.content ?? "";
      if (file.truncated && file.raw_url) text = await (await fetch(file.raw_url)).text();
      if (text.trim()) await applySnapshot(JSON.parse(text));
    }
    await gh(settings.token, `/gists/${gistId}`, {
      method: "PATCH",
      body: JSON.stringify({ files: { [SNAPSHOT_FILE]: { content: JSON.stringify(await buildSnapshot()) } } }),
    });
    saveGistSettings({ ...settings, gistId, lastSyncAt: Date.now(), lastError: undefined });
  } catch (e) {
    saveGistSettings({ ...settings, lastError: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** Sync on start, a few seconds after any change, on reconnect and when the tab is hidden. */
export function startFileSyncLoop() {
  if (typeof window === "undefined") return () => {};
  let timer: number | undefined;
  const run = () => { void syncNow().catch(() => {}); };
  const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(run, 4000); };
  const onHide = () => { if (document.visibilityState === "hidden") run(); };
  const off = onDataChange(soon);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onHide);
  run();
  return () => {
    off(); window.clearTimeout(timer);
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onHide);
  };
}
