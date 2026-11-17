"use client";

import { useEffect, useState } from "react";
import { db, type LessonProgress, type LocalGame, type LocalSession } from "./db";

export function useLocalData() {
  const [sessions, setSessions] = useState<LocalSession[] | null>(null);
  const [games, setGames] = useState<LocalGame[] | null>(null);
  const [lessons, setLessons] = useState<LessonProgress[] | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([db.allSessions(), db.allGames(), db.allLessons()]).then(([s, g, l]) => {
      if (alive) { setSessions(s); setGames(g); setLessons(l); }
    }).catch(() => { if (alive) { setSessions([]); setGames([]); setLessons([]); } });
    return () => { alive = false; };
  }, []);
  return { sessions, games, lessons, loading: sessions === null };
}

export interface TrainerSummary {
  sessions: number;
  attempts: number;
  accuracy: number | null;
  bestNet: number | null;
  bestAccuracy: number | null;
  lastAt: number | null;
}

export function summarize(sessions: LocalSession[], match: (s: LocalSession) => boolean): TrainerSummary {
  const ss = sessions.filter((s) => match(s) && s.attempts.length > 0);
  let attempts = 0, correct = 0, bestNet: number | null = null, bestAcc: number | null = null;
  for (const s of ss) {
    const c = s.attempts.filter((a) => a.correct).length;
    attempts += s.attempts.length;
    correct += c;
    const net = c - (s.attempts.length - c);
    bestNet = bestNet == null ? net : Math.max(bestNet, net);
    if (s.attempts.length >= 10) bestAcc = Math.max(bestAcc ?? 0, c / s.attempts.length);
  }
  return { sessions: ss.length, attempts, accuracy: attempts ? correct / attempts : null, bestNet, bestAccuracy: bestAcc, lastAt: ss[0]?.startedAt ?? null };
}
