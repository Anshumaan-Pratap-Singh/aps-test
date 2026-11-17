"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError, UserSchema } from "@/lib/api";
import { startSyncLoop } from "@/lib/sync";
import { installErrorReporting } from "@/lib/perf";
import { useAuth } from "@/stores/app";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }));
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
    installErrorReporting();
    api("/users/me", {}, UserSchema)
      .then((u) => setUser(u))
      .catch((e) => setUser(null, e instanceof ApiError && e.status === 401 ? "signed_out" : "offline"));
    return startSyncLoop();
  }, [setUser]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
