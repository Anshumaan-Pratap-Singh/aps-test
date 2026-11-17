import { describe, expect, it } from "vitest";
import { classifyPinError, conflictMetrics, conflictTrials, nextLength, pinAnswer, taskSwitchMetrics, taskSwitchTrials, tsAnswer } from "@/features/cognitive/design";

describe("task switch design", () => {
  it("is unambiguous and balanced", () => {
    const t = taskSwitchTrials(1, 5, 48);
    expect(t.filter((x) => x.congruent).length).toBe(24);
    for (const x of t) {
      expect(x.n).not.toBe(5);
      expect(x.correct).toBe(tsAnswer(x.n, x.rule));
      expect((tsAnswer(x.n, "parity") === tsAnswer(x.n, "magnitude"))).toBe(x.congruent);
    }
    expect(t.some((x) => x.switch)).toBe(true);
  });
  it("computes switch cost from correct trials only", () => {
    const t = taskSwitchTrials(2, 5, 20);
    const res = t.map((x) => ({ response: x.correct, rt: x.switch ? 900 : 600, correct: true }));
    const m = taskSwitchMetrics(t, res);
    expect(m.switchCost).toBe(300);
    expect(m.accuracy).toBe(1);
  });
});

describe("conflict design", () => {
  it("balances cells and limits runs", () => {
    const t = conflictTrials(3, 5, 10);
    expect(t.length).toBe(40);
    for (const kind of ["flanker", "simon"]) for (const c of [true, false]) expect(t.filter((x) => x.kind === kind && x.congruent === c).length).toBe(10);
    let run = 1;
    for (let i = 1; i < t.length; i++) { run = t[i]!.kind === t[i - 1]!.kind && t[i]!.congruent === t[i - 1]!.congruent ? run + 1 : 1; expect(run).toBeLessThanOrEqual(3); }
    for (const x of t) if (x.kind === "flanker") expect(x.display[2] === "←" ? "L" : "R").toBe(x.correct);
  });
  it("separates commission and omission errors", () => {
    const t = conflictTrials(4, 5, 4);
    const res = t.map((x, i) => (i === 0 ? { response: null, rt: null, correct: false } : i === 1 ? { response: (x.correct === "L" ? "R" : "L") as "L" | "R", rt: 500, correct: false } : { response: x.correct, rt: x.congruent ? 500 : 560, correct: true }));
    const m = conflictMetrics(t, res);
    expect(m.omissionErrors).toBe(1);
    expect(m.commissionErrors).toBe(1);
    expect(m.congruencyEffect).toBe(60);
  });
});

describe("pincode", () => {
  it("transforms and classifies", () => {
    expect(pinAnswer([3, 1, 4, 1, 5], "backward")).toBe("51413");
    expect(pinAnswer([3, 1, 4, 1, 5], "ascending")).toBe("11345");
    expect(pinAnswer([3, 1, 4, 1, 5], "evens")).toBe("4");
    expect(pinAnswer([9, 0, 2], "plus_one")).toBe("013");
    expect(pinAnswer([7, 2, 9, 4], "positions", [2, 4])).toBe("24");
    expect(classifyPinError("1234", "1243")).toBe("transposition");
    expect(classifyPinError("1234", "123")).toBe("omission");
    expect(classifyPinError("1234", "1235")).toBe("intrusion");
    expect(classifyPinError("1123", "1223")).toBe("substitution");
  });
  it("staircase is 2-up 1-down", () => {
    expect(nextLength(5, 0, true)).toEqual({ len: 5, streak: 1 });
    expect(nextLength(5, 1, true)).toEqual({ len: 6, streak: 0 });
    expect(nextLength(5, 1, false)).toEqual({ len: 4, streak: 0 });
    expect(nextLength(3, 0, false).len).toBe(3);
  });
});
