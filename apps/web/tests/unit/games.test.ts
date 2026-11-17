import { describe, expect, it } from "vitest";
import { applyFill, mtm, newLedger, realised, replay, unrealised } from "@/features/games/framework";
import { MarketMakingGame, fairValue, summarize, TICK, type MMAction } from "@/features/games/marketMaking";
import { EtfGame, navOf, summarizeEtf, view, type EtfAction } from "@/features/games/etf";
import { bayesUpdate, EventGame } from "@/features/games/events";
import { fermiScore, intervalScore, parseMagnitude } from "@/features/games/fermi";
import { evPerUnit, kelly, makeBoard, scoreBoard } from "@/features/games/betting";
import { Rng } from "@/lib/rng";
import { q } from "@/lib/rational";

describe("ledger", () => {
  it("average-cost accounting is exact", () => {
    let l = newLedger();
    l = applyFill(l, 3, 1000); l = applyFill(l, 1, 1100); l = applyFill(l, -2, 1200);
    expect(realised(l).eq(q(350))).toBe(true);
    expect(l.qty).toBe(2);
    l = applyFill(l, -4, 900); // flip short 2
    expect(l.qty).toBe(-2);
    expect(realised(l).add(unrealised(l, 900)).eq(q(mtm(l, 900)))).toBe(true);
  });
  it("mtm = realised + unrealised for random fill sequences", () => {
    const r = new Rng("ledger");
    for (let k = 0; k < 200; k++) {
      let l = newLedger();
      for (let i = 0; i < 30; i++) {
        const qty = r.int(1, 3) * (r.bool() ? 1 : -1);
        l = applyFill(l, qty, r.int(90, 110) * 10);
      }
      const mark = r.int(80, 120) * 10;
      expect(realised(l).add(unrealised(l, mark)).eq(q(mtm(l, mark)))).toBe(true);
    }
  });
});

describe("market making", () => {
  it("fair value is exact for dice", () => {
    const s = MarketMakingGame.init(2, 3); // even seed -> dice
    const { fair } = fairValue(s);
    expect(fair).toBe((s.hidden[0]! + 3.5 * (s.cfg.n - 1)) * 100);
  });
  it("replays deterministically and respects inventory limits", () => {
    for (let seed = 1; seed < 40; seed++) {
      const log: { seq: number; t: number; action: MMAction }[] = [];
      let s = MarketMakingGame.init(seed, 6);
      let i = 0;
      while (!s.over) {
        const { fair } = fairValue(s);
        const a: MMAction = { type: "quote", bid: Math.floor((fair - 50) / TICK) * TICK, ask: Math.ceil((fair + 50) / TICK) * TICK };
        log.push({ seq: i++, t: 0, action: a });
        s = MarketMakingGame.reduce(s, a);
        expect(Math.abs(s.ledger.qty)).toBeLessThanOrEqual(s.cfg.maxInventory);
      }
      const r = replay(MarketMakingGame, seed, 6, log);
      expect(r.ledger.cash).toBe(s.ledger.cash);
      expect(r.ledger.qty).toBe(s.ledger.qty);
      const sum = summarize(s);
      expect(sum.pnl).toBe(s.ledger.cash + s.ledger.qty * sum.settlement);
      expect(sum.score).toBeGreaterThanOrEqual(0);
      expect(sum.score).toBeLessThanOrEqual(100);
    }
  });
  it("rejects invalid quotes", () => {
    const s = MarketMakingGame.init(4, 3);
    const n = MarketMakingGame.reduce(s, { type: "quote", bid: 1000, ask: 1000 });
    expect(n.invalidQuotes).toBe(1);
    expect(n.round).toBe(0);
  });
});

describe("etf", () => {
  it("no positive edge when the premium is zero", () => {
    const s = EtfGame.init(1, 5);
    const v = view({ ...s, premiumBps: 0 });
    expect(v.bestEdge).toBeLessThan(0);
    expect(v.nav).toBe(navOf(s.cons, "mid"));
  });
  it("replays deterministically", () => {
    const actions: EtfAction[] = [];
    for (let i = 0; i < 60; i++) { actions.push({ type: "tick" }); if (i % 7 === 3) actions.push({ type: "arb_rich", units: 2 }); if (i % 11 === 5) actions.push({ type: "unwind" }); }
    const log = actions.map((action, seq) => ({ seq, t: seq, action }));
    const a = replay(EtfGame, 9, 5, log), b = replay(EtfGame, 9, 5, log);
    expect(a.cash).toBe(b.cash);
    expect(a.over).toBe(true);
    const sum = summarizeEtf(a);
    expect(sum.grossPnl - sum.costs).toBeCloseTo(sum.netPnl, 6);
    expect(Math.abs(a.etfUnits)).toBeLessThanOrEqual(a.cfg.maxUnits);
  });
});

describe("events", () => {
  it("bayes update matches exact formula and stays in (0,1)", () => {
    const r = new Rng("bayes");
    for (let i = 0; i < 500; i++) {
      const p = 0.01 + r.next() * 0.98, rel = 0.5 + r.next() * 0.49, yes = r.bool();
      const post = bayesUpdate(p, rel, yes);
      const ly = yes ? rel : 1 - rel, ln = yes ? 1 - rel : rel;
      expect(post).toBeCloseTo((ly * p) / (ly * p + ln * (1 - p)), 6);
      expect(post).toBeGreaterThan(0); expect(post).toBeLessThan(1);
    }
  });
  it("game produces valid states", () => {
    let s = EventGame.init(3, 5);
    while (!s.over) s = EventGame.reduce(s, { type: "quote", bid: 40, ask: 60 });
    expect(s.history.length).toBe(s.rounds);
    expect(Math.abs(s.ledger.qty)).toBeLessThanOrEqual(s.maxInventory);
  });
});

describe("fermi & betting", () => {
  it("interval score penalises misses and width", () => {
    expect(intervalScore(1, 2, 1.5, 0.2)).toBe(1);
    expect(intervalScore(1, 2, 3, 0.2)).toBe(11);
    const tight = fermiScore(1e6, 8e5, 1.3e6, 1e6, 0.8, 10);
    const wide = fermiScore(1e6, 1e3, 1e9, 1e6, 0.8, 10);
    expect(tight.composite).toBeGreaterThan(wide.composite);
    expect(parseMagnitude("3.2 million")).toBe(3.2e6);
    expect(parseMagnitude("40k")).toBe(40000);
    expect(parseMagnitude("1,500")).toBe(1500);
    expect(parseMagnitude("abc")).toBeNull();
  });
  it("kelly & EV", () => {
    expect(evPerUnit(0.5, 2.2)).toBeCloseTo(0.1);
    expect(kelly(0.5, 2.2)).toBeCloseTo(0.1 / 1.2);
    expect(kelly(0.3, 2)).toBe(0);
  });
  it("benchmark stakes score 100 and -EV bets are penalised", () => {
    const board = makeBoard(5, 5);
    const bench: Record<string, number> = {};
    for (const e of board) bench[e.id] = 1000 * Math.min(0.05, 0.5 * kelly(e.p.toNumber(), e.odds));
    const s = scoreBoard(board, bench, 1000, 5);
    if (s.benchEv > 0) expect(s.score).toBeCloseTo(100, 6);
    const neg = board.find((e) => evPerUnit(e.p.toNumber(), e.odds) < 0);
    if (neg) expect(scoreBoard(board, { ...bench, [neg.id]: 50 }, 1000, 5).score).toBeLessThan(s.score);
  });
});
