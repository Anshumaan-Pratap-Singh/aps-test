/**
 * Typed API client. Same-origin (/api is proxied to FastAPI by next.config rewrites),
 * cookies are HttpOnly, and every unsafe request carries the CSRF header.
 * Never called from an answer-submission hot path.
 */
import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, schema?: z.ZodType<T>): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET") headers.set("x-aps-csrf", "1");
  const res = await fetch(`/api/v1${path}`, {
    ...init, headers, credentials: "same-origin",
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const b = await res.json(); msg = typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail); } catch { /* non-JSON */ }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  return schema ? schema.parse(data) : (data as T);
}

export const UserSchema = z.object({ id: z.string(), email: z.string(), display_name: z.string(), created_at: z.string() });
export type User = z.infer<typeof UserSchema>;

export const ServerQuestionSchema = z.object({
  question_id: z.string(),
  question_type: z.string(),
  difficulty: z.number(),
  seed: z.number(),
  prompt_latex: z.string(),
  input_type: z.enum(["numeric", "fraction", "choice", "operator", "multi"]),
  choices: z.array(z.string()),
  skill_tags: z.array(z.string()),
  hint_steps: z.array(z.string()),
  solution_steps: z.array(z.string()),
  answer_display: z.string().optional(),
  rel_tolerance: z.string().optional(),
  generator_version: z.string(),
});
export type ServerQuestion = z.infer<typeof ServerQuestionSchema>;

export const BatchSchema = z.object({ seed: z.number(), questions: z.array(ServerQuestionSchema) });

export const AssessmentStartSchema = z.object({
  session: z.object({ id: z.string(), seed: z.number(), difficulty: z.number(), trainer_type: z.string() }).passthrough(),
  client_session_id: z.string(),
  questions: z.array(ServerQuestionSchema),
});

export const BatchResultSchema = z.object({
  session_id: z.string(), accepted: z.number(), duplicates: z.number(), server_validated: z.boolean(),
  accuracy: z.number().nullable(), correct: z.number(), total: z.number(), score: z.number().nullable(),
});
export type BatchResult = z.infer<typeof BatchResultSchema>;
