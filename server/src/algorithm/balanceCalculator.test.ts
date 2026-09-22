import { describe, it, expect } from "vitest";
import { calculateBalances } from "./balanceCalculator.js";

function balanceOf(result: Array<{ userId: string; balance: number }>, userId: string): number {
  return result.find((r) => r.userId === userId)!.balance;
}

function sumBalances(result: Array<{ balance: number }>): number {
  return result.reduce((s, r) => s + r.balance, 0);
}

describe("calculateBalances", () => {
  it("handles a single expense split equally between two people", () => {
    const result = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [
        {
          paidBy: "a",
          amount: 1000,
          participants: [
            { userId: "a", amount: 500 },
            { userId: "b", amount: 500 },
          ],
        },
      ],
    });

    expect(balanceOf(result, "a")).toBe(500); // paid 1000, owes 500 -> net +500
    expect(balanceOf(result, "b")).toBe(-500); // owes 500
    expect(sumBalances(result)).toBe(0);
  });

  it("handles multiple expenses accumulating for the same people", () => {
    const result = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [
        {
          paidBy: "a",
          amount: 1000,
          participants: [
            { userId: "a", amount: 500 },
            { userId: "b", amount: 500 },
          ],
        },
        {
          paidBy: "b",
          amount: 400,
          participants: [
            { userId: "a", amount: 200 },
            { userId: "b", amount: 200 },
          ],
        },
      ],
    });

    // a: +500 (expense 1) -200 (expense 2) = +300
    // b: -500 (expense 1) +200 (expense 2) = -300
    expect(balanceOf(result, "a")).toBe(300);
    expect(balanceOf(result, "b")).toBe(-300);
    expect(sumBalances(result)).toBe(0);
  });

  it("handles multiple different payers across a group", () => {
    // Matches the worked example from the spec:
    // A owes B 300, B owes C 200, C owes A 100, D owes A 400, D owes B 100
    // Expressed as expenses rather than raw obligations:
    const result = calculateBalances({
      memberIds: ["A", "B", "C", "D"],
      expenses: [
        // B paid 300 for A
        { paidBy: "B", amount: 300, participants: [{ userId: "A", amount: 300 }] },
        // C paid 200 for B
        { paidBy: "C", amount: 200, participants: [{ userId: "B", amount: 200 }] },
        // A paid 100 for C
        { paidBy: "A", amount: 100, participants: [{ userId: "C", amount: 100 }] },
        // A paid 400 for D
        { paidBy: "A", amount: 400, participants: [{ userId: "D", amount: 400 }] },
        // B paid 100 for D
        { paidBy: "B", amount: 100, participants: [{ userId: "D", amount: 100 }] },
      ],
    });

    // A: -300 (owes B) +100 (paid for C) +400 (paid for D) = +200
    // B: +300 (paid for A) -200 (owes C) +100 (paid for D) = +200
    // C: +200 (paid for B) -100 (owes A) = +100
    // D: -400 (owes A) -100 (owes B) = -500
    expect(balanceOf(result, "A")).toBe(200);
    expect(balanceOf(result, "B")).toBe(200);
    expect(balanceOf(result, "C")).toBe(100);
    expect(balanceOf(result, "D")).toBe(-500);
    expect(sumBalances(result)).toBe(0);
  });

  it("handles unequal (exact) splits correctly", () => {
    const result = calculateBalances({
      memberIds: ["a", "b", "c", "d"],
      expenses: [
        {
          paidBy: "a",
          amount: 1000,
          participants: [
            { userId: "a", amount: 400 },
            { userId: "b", amount: 300 },
            { userId: "c", amount: 200 },
            { userId: "d", amount: 100 },
          ],
        },
      ],
    });

    expect(balanceOf(result, "a")).toBe(600); // paid 1000, owes 400
    expect(balanceOf(result, "b")).toBe(-300);
    expect(balanceOf(result, "c")).toBe(-200);
    expect(balanceOf(result, "d")).toBe(-100);
    expect(sumBalances(result)).toBe(0);
  });

  it("returns zero balance for a member with no expenses at all", () => {
    const result = calculateBalances({
      memberIds: ["a", "b", "c"],
      expenses: [
        {
          paidBy: "a",
          amount: 200,
          participants: [
            { userId: "a", amount: 100 },
            { userId: "b", amount: 100 },
          ],
        },
      ],
    });

    expect(balanceOf(result, "c")).toBe(0);
  });

  it("returns an all-zero result when there are no expenses", () => {
    const result = calculateBalances({ memberIds: ["a", "b"], expenses: [] });
    expect(balanceOf(result, "a")).toBe(0);
    expect(balanceOf(result, "b")).toBe(0);
  });

  it("nets a payer who is also a participant in their own expense", () => {
    const result = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [
        {
          paidBy: "a",
          amount: 100,
          participants: [{ userId: "a", amount: 100 }], // solo expense, no one else involved
        },
      ],
    });

    expect(balanceOf(result, "a")).toBe(0); // paid 100, owes 100 -> nets to zero
    expect(balanceOf(result, "b")).toBe(0);
  });

  it("applies settlements to reduce balances (a settlement is not an expense)", () => {
    const result = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [
        {
          paidBy: "a",
          amount: 1000,
          participants: [
            { userId: "a", amount: 500 },
            { userId: "b", amount: 500 },
          ],
        },
      ],
      settlements: [{ fromUserId: "b", toUserId: "a", amount: 500 }],
    });

    // b paid a the 500 they owed -> both settled
    expect(balanceOf(result, "a")).toBe(0);
    expect(balanceOf(result, "b")).toBe(0);
  });

  it("applies a partial settlement, leaving a residual balance", () => {
    const result = calculateBalances({
      memberIds: ["a", "b"],
      expenses: [
        {
          paidBy: "a",
          amount: 1000,
          participants: [
            { userId: "a", amount: 500 },
            { userId: "b", amount: 500 },
          ],
        },
      ],
      settlements: [{ fromUserId: "b", toUserId: "a", amount: 200 }],
    });

    expect(balanceOf(result, "a")).toBe(300);
    expect(balanceOf(result, "b")).toBe(-300);
    expect(sumBalances(result)).toBe(0);
  });

  it("keeps rounding-remainder splits summing to zero across the group", () => {
    // Split 1000 three ways (334/333/333, from the equal-split calculator's
    // largest-remainder method) and verify balances still net to zero.
    const result = calculateBalances({
      memberIds: ["a", "b", "c"],
      expenses: [
        {
          paidBy: "a",
          amount: 1000,
          participants: [
            { userId: "a", amount: 334 },
            { userId: "b", amount: 333 },
            { userId: "c", amount: 333 },
          ],
        },
      ],
    });

    expect(balanceOf(result, "a")).toBe(666);
    expect(balanceOf(result, "b")).toBe(-333);
    expect(balanceOf(result, "c")).toBe(-333);
    expect(sumBalances(result)).toBe(0);
  });

  it("handles many members and many expenses without drift", () => {
    const memberIds = Array.from({ length: 25 }, (_, i) => `user-${i}`);
    const expenses = Array.from({ length: 60 }, (_, i) => {
      const payer = memberIds[i % memberIds.length];
      const amount = 100 + i;
      // Equal-ish split across all members, remainder to the payer so
      // the split always sums exactly to the total.
      const base = Math.floor(amount / memberIds.length);
      const remainder = amount - base * memberIds.length;
      const participants = memberIds.map((id, idx) => ({
        userId: id,
        amount: base + (idx < remainder ? 1 : 0),
      }));
      return { paidBy: payer, amount, participants };
    });

    const result = calculateBalances({ memberIds, expenses });

    expect(result).toHaveLength(25);
    expect(sumBalances(result)).toBe(0);
  });

  it("surfaces a balance for a userId present in expenses but not in memberIds", () => {
    // Defensive case: e.g. a member later removed from the group but
    // whose historical expense still exists. Money should never be
    // silently dropped.
    const result = calculateBalances({
      memberIds: ["a"],
      expenses: [
        {
          paidBy: "a",
          amount: 100,
          participants: [{ userId: "ghost", amount: 100 }],
        },
      ],
    });

    expect(balanceOf(result, "ghost")).toBe(-100);
    expect(balanceOf(result, "a")).toBe(100);
  });
});
