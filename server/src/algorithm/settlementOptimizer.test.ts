import { describe, it, expect } from "vitest";
import { optimizeSettlements, type SettlementTransaction } from "./settlementOptimizer.js";
import type { MemberBalance } from "./balanceCalculator.js";

/** Applies a settlement plan to a set of balances and returns the result. */
function applyPlan(balances: MemberBalance[], plan: SettlementTransaction[]): Map<string, number> {
  const result = new Map(balances.map((b) => [b.userId, b.balance]));
  for (const tx of plan) {
    result.set(tx.from, (result.get(tx.from) ?? 0) + tx.amount);
    result.set(tx.to, (result.get(tx.to) ?? 0) - tx.amount);
  }
  return result;
}

/** Runs every invariant the spec requires against a balances/plan pair. */
function assertInvariants(balances: MemberBalance[], plan: SettlementTransaction[]) {
  const totalPositive = balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const totalOutgoing = plan.reduce((s, tx) => s + tx.amount, 0);

  // 1 & 2: total outgoing === total incoming === total positive balance
  expect(totalOutgoing).toBe(totalPositive);

  // 3: applying settlements zeroes out every balance
  const finalBalances = applyPlan(balances, plan);
  for (const balance of finalBalances.values()) {
    expect(balance).toBe(0);
  }

  // 4: no settlement has amount <= 0
  for (const tx of plan) {
    expect(tx.amount).toBeGreaterThan(0);
  }

  // 5: no one pays themselves
  for (const tx of plan) {
    expect(tx.from).not.toBe(tx.to);
  }
}

describe("optimizeSettlements", () => {
  it("matches the worked example from the spec exactly", () => {
    // A +500, B +100, C -300, D -300
    const balances: MemberBalance[] = [
      { userId: "A", balance: 500 },
      { userId: "B", balance: 100 },
      { userId: "C", balance: -300 },
      { userId: "D", balance: -300 },
    ];

    const plan = optimizeSettlements(balances);

    expect(plan).toEqual([
      { from: "C", to: "A", amount: 300 },
      { from: "D", to: "A", amount: 200 },
      { from: "D", to: "B", amount: 100 },
    ]);
    assertInvariants(balances, plan);
  });

  it("handles a single creditor and single debtor", () => {
    const balances: MemberBalance[] = [
      { userId: "a", balance: 500 },
      { userId: "b", balance: -500 },
    ];
    const plan = optimizeSettlements(balances);
    expect(plan).toEqual([{ from: "b", to: "a", amount: 500 }]);
    assertInvariants(balances, plan);
  });

  it("handles multiple creditors and a single debtor", () => {
    const balances: MemberBalance[] = [
      { userId: "a", balance: 300 },
      { userId: "b", balance: 200 },
      { userId: "c", balance: -500 },
    ];
    const plan = optimizeSettlements(balances);
    expect(plan).toHaveLength(2);
    assertInvariants(balances, plan);
  });

  it("handles a single creditor and multiple debtors", () => {
    const balances: MemberBalance[] = [
      { userId: "a", balance: 500 },
      { userId: "b", balance: -300 },
      { userId: "c", balance: -200 },
    ];
    const plan = optimizeSettlements(balances);
    expect(plan).toHaveLength(2);
    assertInvariants(balances, plan);
  });

  it("handles multiple creditors and multiple debtors", () => {
    const balances: MemberBalance[] = [
      { userId: "a", balance: 400 },
      { userId: "b", balance: 250 },
      { userId: "c", balance: 150 },
      { userId: "d", balance: -300 },
      { userId: "e", balance: -300 },
      { userId: "f", balance: -200 },
    ];
    const plan = optimizeSettlements(balances);
    assertInvariants(balances, plan);
  });

  it("produces no transactions on exact pairwise cancellation with zero balances present", () => {
    const balances: MemberBalance[] = [
      { userId: "a", balance: 0 },
      { userId: "b", balance: 0 },
    ];
    const plan = optimizeSettlements(balances);
    expect(plan).toEqual([]);
  });

  it("ignores members who are already settled (zero balance)", () => {
    const balances: MemberBalance[] = [
      { userId: "a", balance: 500 },
      { userId: "b", balance: -500 },
      { userId: "settled", balance: 0 },
    ];
    const plan = optimizeSettlements(balances);
    expect(plan.some((tx) => tx.from === "settled" || tx.to === "settled")).toBe(false);
    assertInvariants(balances, plan);
  });

  it("handles duplicate balance amounts deterministically", () => {
    const balances: MemberBalance[] = [
      { userId: "a", balance: 200 },
      { userId: "b", balance: 200 },
      { userId: "c", balance: -200 },
      { userId: "d", balance: -200 },
    ];
    const planA = optimizeSettlements(balances);
    const planB = optimizeSettlements(balances);
    expect(planA).toEqual(planB); // same input -> same output every time
    assertInvariants(balances, planA);
  });

  it("handles many members without breaking any invariant", () => {
    // 15 creditors, 15 debtors, uneven amounts that still net to zero.
    const balances: MemberBalance[] = [];
    let runningTotal = 0;
    for (let i = 0; i < 15; i++) {
      const amount = 100 + i * 7;
      balances.push({ userId: `creditor-${i}`, balance: amount });
      runningTotal += amount;
    }
    // Distribute the exact runningTotal across 15 debtors so it nets to zero.
    const base = Math.floor(runningTotal / 15);
    const remainder = runningTotal - base * 15;
    for (let i = 0; i < 15; i++) {
      const amount = base + (i < remainder ? 1 : 0);
      balances.push({ userId: `debtor-${i}`, balance: -amount });
    }

    const plan = optimizeSettlements(balances);
    assertInvariants(balances, plan);
  });

  it("rejects balances that don't net to zero", () => {
    const balances: MemberBalance[] = [
      { userId: "a", balance: 500 },
      { userId: "b", balance: -300 }, // doesn't cancel out
    ];
    expect(() => optimizeSettlements(balances)).toThrow();
  });

  it("returns an empty plan for an empty balance list", () => {
    expect(optimizeSettlements([])).toEqual([]);
  });
});
