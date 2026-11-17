/**
 * Local-first persistence in IndexedDB. Everything the user does is saved here
 * first; the sync queue mirrors it to the server when signed in and online.
 */
import { createStore, del, get, set, values, type UseStore } from "idb-keyval";

export interface LocalAttempt {
  eventId: string;
  questionId: string;
  questionType: string;
  questionVersion: string;
  seed: number;
  prompt: string;
  answer: string;
  expected?: string; // undefined in assessment mode (server-graded)
  correct: boolean | null; // null = awaiting server grading
  responseMs: number;
  index: number;
  tags: string[];
  at: number; // epoch ms
}

export interface LocalSession {
  id: string; // client session id
  trainer: string;
  category: "mental_math" | "probability" | "assessment" | "baseline";
  mode: "practice" | "untimed" | "timed" | "assessment";
  configKey: string;
  difficulty: number;
  seed: number;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  attempts: LocalAttempt[];
  status: "active" | "completed" | "abandoned";
  serverValidated: boolean;
  serverResult?: { correct: number; total: number; score: number | null; accuracy: number | null };
  synced: boolean;
}

export interface LocalGame {
  id: string;
  gameType: string;
  category: "market" | "cognitive";
  difficulty: number;
  seed: number;
  startedAt: number;
  endedAt: number | null;
  score: number | null;
  metrics: Record<string, number | string | boolean | null>;
  events: { seq: number; type: string; payload: Record<string, unknown>; t: number }[];
  initialState: Record<string, unknown>;
  finalState: Record<string, unknown>;
  synced: boolean;
}

export interface LessonProgress {
  id: string;
  status: "in_progress" | "completed";
  checksCorrect: number;
  checksTotal: number;
  answered?: string[];
  updatedAt: number;
}

let stores: { sessions: UseStore; games: UseStore; lessons: UseStore; outbox: UseStore; cache: UseStore } | null = null;

function s() {
  if (!stores) {
    stores = {
      sessions: createStore("aps-sessions", "s"),
      games: createStore("aps-games", "g"),
      lessons: createStore("aps-lessons", "l"),
      outbox: createStore("aps-outbox", "o"),
      cache: createStore("aps-cache", "c"),
    };
  }
  return stores;
}

export const db = {
  saveSession: (x: LocalSession) => set(x.id, x, s().sessions),
  getSession: (id: string) => get<LocalSession>(id, s().sessions),
  allSessions: async () => ((await values<LocalSession>(s().sessions)) ?? []).sort((a, b) => b.startedAt - a.startedAt),
  saveGame: (x: LocalGame) => set(x.id, x, s().games),
  allGames: async () => ((await values<LocalGame>(s().games)) ?? []).sort((a, b) => b.startedAt - a.startedAt),
  saveLesson: (x: LessonProgress) => set(x.id, x, s().lessons),
  allLessons: async () => (await values<LessonProgress>(s().lessons)) ?? [],
  outboxPut: (id: string, job: OutboxJob) => set(id, job, s().outbox),
  outboxAll: async () => (await values<OutboxJob>(s().outbox)) ?? [],
  outboxDel: (id: string) => del(id, s().outbox),
  cacheGet: <T>(k: string) => get<T>(k, s().cache),
  cacheSet: (k: string, v: unknown) => set(k, v, s().cache),
};

export type OutboxJob =
  | { id: string; kind: "session"; sessionId: string; attempts: number; tries: number; nextAt: number }
  | { id: string; kind: "game"; gameId: string; tries: number; nextAt: number };
