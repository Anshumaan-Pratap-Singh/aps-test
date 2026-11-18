"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { api, ApiError, UserSchema } from "@/lib/api";
import { startSyncLoop } from "@/lib/sync";
import { startFileSyncLoop } from "@/lib/fileSync";
import { installErrorReporting } from "@/lib/perf";
import { useAuth } from "@/stores/app";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }));
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
    installErrorReporting();
    // Static GitHub Pages build: no backend, so skip the session check and sync via Gist/file instead.
    if (process.env.NEXT_PUBLIC_STATIC) {
      setUser(null, "offline");
      return startFileSyncLoop();
    }
    api("/auth/session", {}, z.object({ user: UserSchema.nullable() }))
      .then((r) => setUser(r.user))
      .catch((e) => setUser(null, e instanceof ApiError && e.status === 401 ? "signed_out" : "offline"));
    return startSyncLoop();
  }, [setUser]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
