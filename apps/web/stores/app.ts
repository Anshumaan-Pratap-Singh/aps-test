"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/api";

interface AuthState {
  user: User | null;
  status: "unknown" | "signed_in" | "signed_out" | "offline";
  setUser: (u: User | null, status?: AuthState["status"]) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "unknown",
  setUser: (user, status) => set({ user, status: status ?? (user ? "signed_in" : "signed_out") }),
}));

interface PrefsState {
  /** Current adaptive difficulty per trainer key. */
  levels: Record<string, number>;
  baselineDone: boolean;
  setLevel: (key: string, level: number) => void;
  setBaselineDone: (v: boolean) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      levels: {},
      baselineDone: false,
      setLevel: (key, level) => set((s) => ({ levels: { ...s.levels, [key]: Math.max(1, Math.min(10, level)) } })),
      setBaselineDone: (baselineDone) => set({ baselineDone }),
    }),
    { name: "aps-prefs" },
  ),
);
