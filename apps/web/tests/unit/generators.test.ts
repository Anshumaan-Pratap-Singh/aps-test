import { describe, expect, it } from "vitest";
import { generateQuestion, ARITHMETIC, checkAnswer } from "@/features/trainer/generators";
import { isUnambiguous, polyNext } from "@/features/trainer/generators/sequences";
import { dec, parseNumber, q } from "@/lib/rational";
import { Rng } from "@/lib/rng";

const TYPES = [...Object.keys(ARITHMETIC), "mixed", "sequence", "fraction_conversion"];

describe("rational", () => {
  it("is exact", () => {
    expect(dec("0.1").add(dec("0.2")).eq(dec("0.3"))).toBe(true);
    expect(dec("66").mul(dec("2.1")).toString()).toBe("138.6");
    expect(dec("3.6").div(dec("0.12")).toString()).toBe("30");
    expect(q(1, 3).toString()).toBe("1/3");
    expect(q(-7, 4).toString()).toBe("-1.75");
  });
  it("parses user input", () => {
    expect(parseNumber("1/8")?.eq(q(1, 8))).toBe(true);
    expect(parseNumber("12.5%")?.eq(dec("12.5"))).toBe(true);
    expect(parseNumber(" 1,200 ")?.eq(q(1200))).toBe(true);
    expect(parseNumber(".5")?.eq(q(1, 2))).toBe(true);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("1/0")).toBeNull();
    expect(parseNumber("1e5")).toBeNull();
  });
});

describe("rng", () => {
  it("is deterministic", () => {
    const a = new Rng("x"), b = new Rng("x");
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });
});

describe("generators", () => {
  it.each(TYPES)("%s produces verified, deterministic questions across difficulties", (type) => {
    for (let d = 1; d <= 10; d++) {
      for (let s = 0; s < 25; s++) {
        const a = generateQuestion(type, s, d);
        const b = generateQuestion(type, s, d);
        expect(a.prompt).toBe(b.prompt);
        expect(checkAnswer(a, a.answerDisplay)).toBe(true);
        expect(a.prompt.length).toBeGreaterThan(0);
      }
    }
  });

  it("sequence answers are unambiguous", () => {
    for (let s = 0; s < 200; s++) {
      const qn = generateQuestion("sequence", s, 1 + (s % 10));
      const shown = qn.prompt.replace(",\\ ?", "").split(",\\ ").map(Number);
      expect(isUnambiguous(shown, Number(qn.answerDisplay))).toBe(true);
    }
  });

  it("matches spec sequence examples", () => {
    expect(polyNext([3, 8, 15, 24, 35].map((x) => q(x)), 2)?.toString()).toBe("48");
    expect(polyNext([2, 6, 12, 20, 30].map((x) => q(x)), 2)?.toString()).toBe("42");
  });

  it("rejects wrong answers", () => {
    const qn = generateQuestion("multiplication", 1, 5);
    expect(checkAnswer(qn, "-999999")).toBe(false);
    expect(checkAnswer(qn, "")).toBe(false);
  });
});
