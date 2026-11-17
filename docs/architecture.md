# APS architecture

This document describes how APS is built today. Anything not yet built is marked **planned**.

## 1. System overview

```
 Browser (Next.js client components)
 ├── Training engines (TS, pure)  ── generate/grade locally, no network on the hot path
 ├── Game engines (TS reducers)   ── seeded, integer-cent accounting, event logs
 ├── IndexedDB (local-first store) ── sessions, games, lessons, outbox, cache
 └── Sync loop ──(batched, idempotent)──►  /api/v1/*  (same origin, proxied by Next.js)
                                             │
                                FastAPI (services/api)
                                ├── engines/   Python reference engines (questions, markets, scoring, adaptive)
                                ├── services/  ingestion + server-side grading
                                ├── api/v1/    routers (auth, users, tracks, questions, sessions, games, progress, code)
                                └── models/    SQLAlchemy 2 (async) ──► PostgreSQL 16 (Alembic migrations)
                                                                    └─► Redis (rate limiting; optional)
```

Repository layout:

| Path | Contents |
|---|---|
| `apps/web` | Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, KaTeX, Zustand, TanStack Query, Zod |
| `apps/web/features/*` | One folder per product area: `trainer`, `games`, `cognitive`, `problems`, `research`, `coding`, `lessons`, `assessments`, `progress`, `dashboard`, `account` |
| `apps/web/lib` | `rational.ts` (exact BigInt rationals), `rng.ts` (seeded PRNG), `stats.ts`, `analytics.ts`, `adaptive.ts`, `db.ts` (IndexedDB), `sync.ts`, `perf.ts`, `api.ts` |
| `services/api/app/engines` | `questions/` (arithmetic, sequences, fractions, probability, olympiad, exact evaluator, registry), `markets/` (quoting, ETF, event, scoring, Markov), `adaptive.py`, `stats.py` |
| `services/api/alembic` | Migrations (the spec's `database/migrations` lives here, next to the models it migrates) |
| `packages/contracts/curriculum.json` | Shared curriculum contract: read by the web app *and* seeded into PostgreSQL |

## 2. Frontend state strategy

* **Server Components** render static content: category dashboards' shells, lesson pages (KaTeX rendered at build time), coding problem statements. 67 routes are prerendered.
* **Client Components** only where interaction happens (trainers, games, charts fed by IndexedDB).
* **Training hot path** (`features/trainer/engine.ts` + `useTrainer.ts`):
  * `TrainingEngine` is a framework-agnostic state machine held in a `useRef`. It owns the question index, timestamps, attempts, deadline and the duplicate-submission guard.
  * React state holds only what is rendered: current question, a stats snapshot, last feedback, phase.
  * `submit()` is synchronous: grade → push attempt → compute stats → `setState`. No `await`, no network.
  * The next question is pre-generated in a microtask, so Enter never waits on generation.
  * IndexedDB writes are coalesced (250 ms) and flushed on `visibilitychange`/`pagehide` for crash recovery.
* **Timer**: elapsed = `performance.now() − startTs`. Nothing decrements on an interval. `Countdown` reads time on each `requestAnimationFrame` and writes `textContent` directly (no React re-render per frame); a coarse timeout guarantees expiry in throttled background tabs. Answers after the deadline are rejected by the engine.
* **Zustand**: auth status and persisted preferences (adaptive levels, baseline flag). **TanStack Query**: server analytics on the Progress page.
* **Zod** validates every API payload the client depends on (`lib/api.ts`).

## 3. Persistence and synchronisation

1. A session starts locally with a seed; questions are generated locally (practice) or fetched without answers (assessment).
2. Attempts are stored in IndexedDB with a client `eventId` (UUID).
3. On completion the session is put in the **outbox**. `lib/sync.ts` drains it every 30 s, on `online`, and after sign-in.
4. Uploads are chunked (≤ 200 attempts) with stable idempotency keys; the server namespaces keys per user (SHA-256) and also de-duplicates attempts by `client_event_id` (`ON CONFLICT DO NOTHING`). Concurrent identical requests are handled (IntegrityError → stored response).
5. Failed uploads retry with exponential backoff (2 s → 5 min). 401 keeps everything queued; 400/403/409 are permanent and drop the job (the local copy is kept).
6. The server recomputes session statistics from stored attempts — never from client-reported aggregates.

Game sessions follow the same pattern (`/games/{type}/sessions` is idempotent on `client_session_id`; events are unique on `(game_session_id, sequence_number)`).

## 4. Integrity model for competitive results

* **Practice** batches (`POST /questions/generate`) include answers so the client can grade offline. They are never used for rankings.
* **Assessments** (`POST /sessions/assessment`) are created by the server with a server-chosen seed. Questions are returned *without* answers. When attempts arrive, the server regenerates each question from `(trainer, seed, difficulty)`, checks the `question_id`, and grades the submitted answer itself. The client's `is_correct` is ignored.
* `/questions/validate` refuses seeds that belong to the caller's active assessment.
* **Benchmarks** use only completed, server-validated assessments in the same cohort: `(trainer_type, difficulty, config_key)` in a 90-day window, one best score per user. Quantiles use PostgreSQL `percentile_cont`; the user's percentile is a mid-rank estimate. Cohorts below `APS_MIN_COHORT_SIZE` (default 30) are suppressed; below 3× that they are labelled *provisional*.
* Game scores are client-computed and stored with `server_validated: false`; they are not ranked. Server-side replay validation of games is **planned** (the reducers are deterministic, so it is a port of the TS engines or a shared WASM build).

## 5. Exactness

* TypeScript: `Q` (BigInt numerator/denominator). Python: `fractions.Fraction` / `decimal.Decimal`. Answers are compared exactly; only estimation and recurring-decimal items declare a tolerance.
* Each Python generator records a machine-checkable expression; `exact_eval` (AST-whitelisted, no `eval`) recomputes it. Probability and olympiad items are verified against exhaustive enumeration / brute force before being served.
* Sequences are rejected if a simpler model (low-degree polynomial, geometric) fits the shown terms but predicts a different next term.
* Money: integer cents in game engines; the open position's cost basis is an exact rational so `mtm = realised + unrealised` holds exactly. PostgreSQL uses `NUMERIC(18,6)` for P&L; response times are `BIGINT` microseconds.

## 6. Engines and scoring definitions

| Engine | Definition |
|---|---|
| Two-sided quoting | `h = max(tick, h0 + kσ·σ + kτ·τ·σ)`, `skew = γ·q·σ²`, `mid = fair − skew`, bid/ask floored/ceiled to tick; no bid at `+maxInv`, no ask at `−maxInv` (`markets/quoting.py`, `games/marketMaking.ts`) |
| Market-making game score | `50 + 40·tanh((PnL − benchmarkPnL)/σ₀) + 10·tanh(spreadCaptured/σ₀) − 3·riskHits − 2·invalidQuotes`, clamped to [0, 100]; the benchmark is the reference quoter on identical flow |
| Event update | `logit p′ = logit p ± ln(r/(1−r))`, clamped to [1e-4, 1−1e-4] |
| ETF edge | sell-ETF edge = `ETF_bid − NAV_ask − costs`; buy-ETF edge = `NAV_bid − ETF_ask − costs` |
| Fermi | interval score on log₁₀ values: `(u−l) + (2/α)(l−x)⁺ + (2/α)(x−u)⁺`; composite `100·exp(−IS/2)·speed`, `speed ∈ [0.8, 1]` |
| Betting board | `100 × EV(stakes) / EV(½-Kelly, 5% cap)` minus penalties for −EV stakes and over-Kelly staking; realised luck is shown but not scored |
| Adaptive difficulty | window of 20: ≥90% & median ≤ target → +1; ≥90% & slow → hold; <60% → −1; target = 2500 + 900·(L−1) ms |
| Mastery | EWMA of per-session accuracy (α = 0.3) × n/(n+20) |
| Spaced repetition | SM-2-style ease/interval per skill; quality = round(5·accuracy) |
| Readiness | `Σ wᵢ·masteryᵢ / Σ wᵢ` over skills with ≥ 20 observations, reported with coverage `Σ wᵢ` |

## 7. Performance strategy and measured results

Targets (engineering goals, not guarantees) and measurements on the reference environment: **headless Chromium 1.63, 4 vCPU Intel Xeon @ 2.10 GHz, Linux, production build**, 300 consecutive answers in the multiplication trainer (script: scripted `fill` + `Enter`).

| Measurement | Target | Measured |
|---|---|---|
| Local answer processing (grade + stats) | p95 < 5 ms | p50 0.2 ms · **p95 0.3 ms** · p99 0.4 ms (browser timer resolution ≈ 0.1 ms) |
| Input → next-question paint (keydown timestamp → first frame after commit) | p95 < 50 ms | p50 9.5 ms · **p95 16.7 ms** · p99 32.1 ms |
| Network dependency on submit | none | none (no fetch in the submit path; verified by design and E2E) |
| Duplicate submissions | 0 | engine guard by question index; unit + E2E tested |
| Timer accuracy | drift < 100 ms / 10 min | elapsed is computed from the start timestamp (unit-tested with a fake clock at 600 000 ms). A real 60 s sprint ended 60.2 s after the start click, including click and render overhead. A real 10-minute run has not been measured. |
| INP | "good" | Event Timing samples are collected and shown on Progress → Performance diagnostics; no field data yet |

Every user can see their own device's numbers on the Progress page.

## 8. Security model

* **Auth**: Argon2id hashing via `pwdlib`; HS256 JWT (PyJWT) in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` when `APS_COOKIE_SECURE=true`); Bearer tokens accepted for non-browser clients. Production refuses to start with the default secret. Login does a dummy hash verify for unknown emails to equalise timing.
* **CSRF**: cookie-authenticated unsafe requests must send `X-APS-CSRF: 1`; CORS only allows the configured origin. The web app proxies `/api` same-origin.
* **Rate limiting**: fixed window per IP (Redis, in-process fallback); stricter limits on register/login.
* **Validation**: Pydantic on every request; SQLAlchemy parameterised queries only.
* **XSS**: React escaping; KaTeX with `trust: false`, `maxExpand`, `maxSize`; the only `dangerouslySetInnerHTML` uses are KaTeX output from our own sources and the code highlighter, which escapes all input.
* **Headers**: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
* **Privacy**: structured logs record method, path, status and latency only — never bodies, cookies or tokens. Users can export (`GET /users/me/export`) and hard-delete (`DELETE /users/me`, FK cascades) their data; local data can be exported or cleared from the Account page.
* **Secrets**: environment variables only (`.env.example`).

## 9. Code execution

* The API **never** executes submitted code. `POST /api/v1/code/run` returns 501 unless an external sandbox is configured, and even then the adapter boundary is not yet implemented (**planned**).
* Today, Python runs client-side: Pyodide (WebAssembly) in a dedicated Web Worker, self-hosted under `/pyodide` (no CDN). The page terminates the worker on wall-clock timeout, which also kills infinite loops. Hidden tests run locally, so they are hidden in the UI but not secret.
* **Planned sandbox service** (separate deployment, not in the API container): one job per microVM/gVisor sandbox; no network; read-only root FS with a size-limited tmpfs; cgroup CPU and memory limits; wall-clock kill; seccomp; non-root UID; toolchains for Python and C++ (`-O2`, ASan/TSan variants); secret hidden tests stored server-side; results returned to the API via a queue.

## 10. Observability

* JSON logs per request with `request_id`, path, status and latency (`app/main.py`); unhandled exceptions are logged with the request id and return a generic 500.
* Client: window `error` / `unhandledrejection` capture and Event Timing samples (`lib/perf.ts`).
* Game event logs can be inspected via `GET /api/v1/games/{id}/events`; session attempt history via `GET /api/v1/sessions/{id}`.
* **Planned**: metrics export (Prometheus/OpenTelemetry) for API/DB latency, sync failures and generator verification failures.

## 11. Extending APS

* **New question type**: add a generator in `services/api/app/engines/questions/`, register it in `registry.py` (verifier included), and, for offline practice, a TS generator in `apps/web/features/trainer/generators/`. Tests iterate the registry automatically.
* **New game**: implement `GameDef<S, A>` (pure `init`/`reduce`/`isOver`) in `features/games/`, render it with `useGame`, add its type to `GAME_TYPES` on the server.
* **New lesson**: add an item to `packages/contracts/curriculum.json` and a component in `features/lessons/*.tsx` mapped in `registry.ts`. Unmapped items show as *Planned*.
