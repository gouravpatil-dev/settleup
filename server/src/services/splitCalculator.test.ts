import { describe, it, expect } from "vitest";
import {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateShareSplit,
} from "./splitCalculator.js";

function sumAmounts(results: Array<{ amount: number }>): number {
  return results.reduce((s, r) => s + r.amount, 0);
}

describe("calculateEqualSplit", () => {
  it("splits evenly when it divides cleanly", () => {
    const result = calculateEqualSplit(1000, ["a", "b", "c", "d"]);
    expect(result.map((r) => r.amount)).toEqual([250, 250, 250, 250]);
    expect(sumAmounts(result)).toBe(1000);
  });

  it("distributes the remainder by one unit when it doesn't divide cleanly", () => {
    // 1000 / 3 = 333.33 -> 334, 333, 333 (sum must be exactly 1000)
    const result = calculateEqualSplit(1000, ["a", "b", "c"]);
    expect(sumAmounts(result)).toBe(1000);
    expect(result.filter((r) => r.amount === 334)).toHaveLength(1);
    expect(result.filter((r) => r.amount === 333)).toHaveLength(2);
  });

  it("gives the whole amount to a single participant", () => {
    const result = calculateEqualSplit(500, ["a"]);
    expect(result).toEqual([{ userId: "a", amount: 500, percentage: null, shares: null }]);
  });

  it("handles many participants without losing or creating money", () => {
    const ids = Array.from({ length: 37 }, (_, i) => `user-${i}`);
    const result = calculateEqualSplit(100000, ids);
    expect(sumAmounts(result)).toBe(100000);
    expect(result).toHaveLength(37);
  });

  it("rejects a non-positive amount", () => {
    expect(() => calculateEqualSplit(0, ["a", "b"])).toThrow();
    expect(() => calculateEqualSplit(-100, ["a", "b"])).toThrow();
  });

  it("rejects a non-integer amount", () => {
    expect(() => calculateEqualSplit(100.5, ["a", "b"])).toThrow();
  });

  it("rejects an empty participant list", () => {
    expect(() => calculateEqualSplit(1000, [])).toThrow();
  });

  it("rejects duplicate participants", () => {
    expect(() => calculateEqualSplit(1000, ["a", "b", "a"])).toThrow();
  });
});

describe("calculateExactSplit", () => {
  it("accepts amounts that sum exactly to the total", () => {
    const result = calculateExactSplit(1000, [
      { userId: "a", amount: 400 },
      { userId: "b", amount: 300 },
      { userId: "c", amount: 200 },
      { userId: "d", amount: 100 },
    ]);
    expect(sumAmounts(result)).toBe(1000);
  });

  it("rejects amounts that don't sum to the total", () => {
    expect(() =>
      calculateExactSplit(1000, [
        { userId: "a", amount: 400 },
        { userId: "b", amount: 300 },
      ])
    ).toThrow();
  });

  it("allows a zero-amount participant (present but not owing anything)", () => {
    const result = calculateExactSplit(1000, [
      { userId: "a", amount: 1000 },
      { userId: "b", amount: 0 },
    ]);
    expect(sumAmounts(result)).toBe(1000);
  });

  it("rejects a negative amount", () => {
    expect(() =>
      calculateExactSplit(1000, [
        { userId: "a", amount: 1200 },
        { userId: "b", amount: -200 },
      ])
    ).toThrow();
  });

  it("rejects duplicate participants", () => {
    expect(() =>
      calculateExactSplit(1000, [
        { userId: "a", amount: 500 },
        { userId: "a", amount: 500 },
      ])
    ).toThrow();
  });
});

describe("calculatePercentageSplit", () => {
  it("splits according to whole-number percentages", () => {
    const result = calculatePercentageSplit(1000, [
      { userId: "a", percentage: 40 },
      { userId: "b", percentage: 30 },
      { userId: "c", percentage: 20 },
      { userId: "d", percentage: 10 },
    ]);
    expect(result.map((r) => r.amount)).toEqual([400, 300, 200, 100]);
    expect(sumAmounts(result)).toBe(1000);
  });

  it("handles repeating-decimal percentages (e.g. thirds) without losing a unit", () => {
    const result = calculatePercentageSplit(1000, [
      { userId: "a", percentage: 33.33 },
      { userId: "b", percentage: 33.33 },
      { userId: "c", percentage: 33.34 },
    ]);
    expect(sumAmounts(result)).toBe(1000);
  });

  it("rejects percentages that don't sum to 100", () => {
    expect(() =>
      calculatePercentageSplit(1000, [
        { userId: "a", percentage: 40 },
        { userId: "b", percentage: 40 },
      ])
    ).toThrow();
  });

  it("rejects a zero or negative percentage", () => {
    expect(() =>
      calculatePercentageSplit(1000, [
        { userId: "a", percentage: 100 },
        { userId: "b", percentage: 0 },
      ])
    ).toThrow();
  });

  it("rejects duplicate participants", () => {
    expect(() =>
      calculatePercentageSplit(1000, [
        { userId: "a", percentage: 50 },
        { userId: "a", percentage: 50 },
      ])
    ).toThrow();
  });
});

describe("calculateShareSplit", () => {
  it("splits proportionally to share counts", () => {
    // shares 2:1:1 of 400 -> 200:100:100
    const result = calculateShareSplit(400, [
      { userId: "a", shares: 2 },
      { userId: "b", shares: 1 },
      { userId: "c", shares: 1 },
    ]);
    expect(result.map((r) => r.amount)).toEqual([200, 100, 100]);
    expect(sumAmounts(result)).toBe(400);
  });

  it("handles shares that don't divide evenly", () => {
    // shares 1:1:1 of 100 -> remainder distributed, sum must stay 100
    const result = calculateShareSplit(100, [
      { userId: "a", shares: 1 },
      { userId: "b", shares: 1 },
      { userId: "c", shares: 1 },
    ]);
    expect(sumAmounts(result)).toBe(100);
  });

  it("rejects a zero or negative share count", () => {
    expect(() =>
      calculateShareSplit(1000, [
        { userId: "a", shares: 1 },
        { userId: "b", shares: 0 },
      ])
    ).toThrow();
  });

  it("rejects a non-integer share count", () => {
    expect(() =>
      calculateShareSplit(1000, [
        { userId: "a", shares: 1.5 },
        { userId: "b", shares: 1 },
      ])
    ).toThrow();
  });

  it("rejects duplicate participants", () => {
    expect(() =>
      calculateShareSplit(1000, [
        { userId: "a", shares: 1 },
        { userId: "a", shares: 1 },
      ])
    ).toThrow();
  });
});
