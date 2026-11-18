/**
 * Background sync: drains the IndexedDB outbox to the API with stable idempotency
 * keys, exponential backoff and chunking. Safe to call repeatedly / concurrently.
 */
import { api, ApiError, BatchResultSchema } from "./api";
import { db, type LocalGame, type LocalSession, type OutboxJob } from "./db";

const CHUNK = 200;
let running = false;

export async function enqueueSession(session: LocalSession) {
  await db.outboxPut(`s:${session.id}`, { id: `s:${session.id}`, kind: "session", sessionId: session.id, attempts: session.attempts.length, tries: 0, nextAt: 0 });
  void drain();
}

export async function enqueueGame(game: LocalGame) {
  await db.outboxPut(`g:${game.id}`, { id: `g:${game.id}`, kind: "game", gameId: game.id, tries: 0, nextAt: 0 });
  void drain();
}

const inflight = new Map<string, Promise<void>>();

/** Sync one session. Concurrent calls for the same session share one request chain. */
export function syncSession(session: LocalSession): Promise<void> {
  const existing = inflight.get(session.id);
  if (existing) return existing;
  const p = doSyncSession(session).finally(() => inflight.delete(session.id));
  inflight.set(session.id, p);
  return p;
}

async function doSyncSession(session: LocalSession): Promise<void> {
  const chunks = Math.max(1, Math.ceil(session.attempts.length / CHUNK));
  for (let c = 0; c < chunks; c++) {
    const part = session.attempts.slice(c * CHUNK, (c + 1) * CHUNK);
    const last = c === chunks - 1;
    const res = await api("/attempts/batch", {
      method: "POST",
      json: {
        idempotency_key: `${session.id}:${c}:${part.length}:${last && session.status === "completed" ? "f" : "p"}`,
        complete: last && session.status === "completed",
        duration_us: Math.round(session.durationMs * 1000),
        session: {
          client_session_id: session.id, trainer_type: session.trainer, mode: session.mode === "assessment" ? "assessment" : "practice",
          difficulty: session.difficulty, seed: session.seed, config_key: session.configKey,
          started_at: new Date(session.startedAt).toISOString(),
        },
        attempts: part.map((a) => ({
          client_event_id: a.eventId, question_id: a.questionId, question_type: a.questionType, question_version: a.questionVersion,
          question_seed: a.seed, skill_tags: a.tags, submitted_answer: a.answer.slice(0, 64), is_correct: a.correct ?? false,
          response_us: Math.round(a.responseMs * 1000), attempt_number: a.index,
        })),
      },
    }, BatchResultSchema);
    if (last) {
      session.synced = true;
      session.serverValidated = res.server_validated;
      session.serverResult = { correct: res.correct, total: res.total, score: res.score, accuracy: res.accuracy };
      await db.saveSession(session);
    }
  }
}

async function syncGame(game: LocalGame): Promise<void> {
  const created = await api<{ id: string }>(`/games/${game.gameType}/sessions`, {
    method: "POST", json: { client_session_id: game.id, difficulty: game.difficulty, seed: game.seed, initial_state: game.initialState },
  });
  await api(`/games/${created.id}/complete`, {
    method: "POST",
    json: {
      events: game.events.slice(0, 5000).map((e) => ({ sequence_number: e.seq, event_type: e.type, event_payload: e.payload, event_timestamp: e.t })),
      final_state: game.finalState, metrics: game.metrics, score: game.score,
      realised_pnl: typeof game.metrics.realisedPnl === "number" ? game.metrics.realisedPnl.toFixed(6) : null,
      mark_to_market_pnl: typeof game.metrics.mtmPnl === "number" ? game.metrics.mtmPnl.toFixed(6) : null,
    },
  });
  game.synced = true;
  await db.saveGame(game);
}

export async function drain(): Promise<{ sent: number; failed: number }> {
  if (process.env.NEXT_PUBLIC_STATIC) return { sent: 0, failed: 0 }; // static build: no server to sync to
  if (running || typeof navigator !== "undefined" && !navigator.onLine) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0, failed = 0;
  try {
    const jobs = (await db.outboxAll()).filter((j) => j.nextAt <= Date.now());
    for (const job of jobs) {
      try {
        if (job.kind === "session") {
          const sess = await db.getSession(job.sessionId);
          if (sess) await syncSession(sess);
        } else {
          const game = (await db.allGames()).find((g) => g.id === job.gameId);
          if (game) await syncGame(game);
        }
        await db.outboxDel(job.id);
        sent++;
      } catch (e) {
        failed++;
        if (e instanceof ApiError && e.status === 401) break; // not signed in: keep everything queued
        if (e instanceof ApiError && (e.status === 409 || e.status === 400 || e.status === 403)) {
          await db.outboxDel(job.id); // permanent rejection; local copy is kept
          continue;
        }
        const tries = job.tries + 1;
        await db.outboxPut(job.id, { ...job, tries, nextAt: Date.now() + Math.min(300_000, 2000 * 2 ** tries) } as OutboxJob);
      }
    }
  } finally {
    running = false;
  }
  return { sent, failed };
}

export function startSyncLoop() {
  if (typeof window === "undefined") return () => {};
  const tick = () => void drain();
  window.addEventListener("online", tick);
  const t = window.setInterval(tick, 30_000);
  tick();
  return () => { window.removeEventListener("online", tick); window.clearInterval(t); };
}
