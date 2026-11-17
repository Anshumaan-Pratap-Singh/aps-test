import { describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrainingEngine, type DisplayQuestion } from "@/features/trainer/engine";
import { TrainerConsole } from "@/features/trainer/TrainerConsole";

const q = (i: number): DisplayQuestion => ({ id: `q${i}`, type: "t", seed: i, version: "1", prompt: `${i} + 1 = ?`, inputType: "numeric", tags: ["arithmetic"], hints: [], solution: [], answerDisplay: String(i + 1), grade: (s) => s.trim() === String(i + 1) });

describe("TrainingEngine", () => {
  it("timer is computed from the start timestamp (no drift) and deadline ends the session", () => {
    let now = 1000;
    const e = new TrainingEngine({ questionAt: q, durationMs: 600_000, clock: () => now });
    e.start();
    now += 599_999.5;
    expect(e.remaining()).toBeCloseTo(0.5, 6);
    expect(e.elapsed()).toBeCloseTo(599_999.5, 6);
    now += 1;
    expect(e.submit("1")).toBeNull();
    expect(e.phase).toBe("finished");
    expect(e.elapsed()).toBe(600_000);
  });
  it("ignores duplicate submissions for the same question and records response times", () => {
    let now = 0;
    const e = new TrainingEngine({ questionAt: q, questionLimit: 3, clock: () => now });
    e.start();
    now = 120;
    expect(e.submit("1", 0)?.responseMs).toBe(120);
    expect(e.submit("1", 0)).toBeNull(); // stale index
    now = 300;
    expect(e.submit("2")?.responseMs).toBe(180);
    expect(e.submit("")).toBeNull();
    now = 310;
    e.submit("999");
    expect(e.phase).toBe("finished");
    const s = e.stats();
    expect([s.attempts, s.correct, s.incorrect, s.bestStreak]).toEqual([3, 2, 1, 2]);
    expect(s.medianMs).toBe(120);
  });
});

describe("TrainerConsole", () => {
  it("Enter submits, the next question appears, stats update and focus stays on the input", async () => {
    const user = userEvent.setup();
    render(<TrainerConsole meta={{ trainer: "t", category: "mental_math", mode: "untimed", configKey: "x", difficulty: 1, seed: 1 }} questionAt={q} questionLimit={5} showFeedback />);
    await user.click(screen.getByTestId("start-session"));
    const input = screen.getByTestId("answer-input");
    expect(input).toHaveFocus();
    await user.type(input, "1{Enter}");
    expect(screen.getByTestId("question-index")).toHaveTextContent("Q2 / 5");
    expect(screen.getByTestId("stat-correct")).toHaveTextContent("1");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    await user.type(input, "7{Enter}");
    expect(screen.getByTestId("stat-correct")).toHaveTextContent("1");
    expect(screen.getByTestId("feedback")).toHaveTextContent("✗");
    await act(async () => { await user.keyboard("{Enter}"); }); // empty -> ignored
    expect(screen.getByTestId("question-index")).toHaveTextContent("Q3 / 5");
  });
});
