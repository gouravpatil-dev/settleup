import { ValidationError } from "../utils/AppError.js";
import type { MemberBalance } from "./balanceCalculator.js";

export interface SettlementTransaction {
  from: string;
  to: string;
  /** Integer minor units. Always > 0. */
  amount: number;
}

/**
 * Turns a set of net balances into a reduced set of settlement
 * transactions using greedy creditor/debtor matching: repeatedly pay
 * the largest remaining debtor to the largest remaining creditor
 * until every balance is zero.
 *
 * This is NOT guaranteed to produce the minimum possible number of
 * transactions in every case (that's a harder problem — see Phase 13
 * in the build plan for an exact solver). It does guarantee:
 *   1. total outgoing === total incoming === total positive balance
 *   2. applying the plan zeroes out every balance
 *   3. every transaction amount is > 0
 *   4. no one pays themselves
 *   5. deterministic output for the same input
 */
export function optimizeSettlements(balances: MemberBalance[]): SettlementTransaction[] {
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b }))
    .sort(byBalanceDescThenId);

  const debtorsRaw = balances.filter((b) => b.balance < 0);
  const debtors = debtorsRaw
    .map((b) => ({ userId: b.userId, balance: -b.balance })) // work with positive "amount owed"
    .sort(byBalanceDescThenId);

  const totalCredit = creditors.reduce((s, c) => s + c.balance, 0);
  const totalDebt = debtors.reduce((s, d) => s + d.balance, 0);
  if (totalCredit !== totalDebt) {
    // Indicates the balances passed in don't actually net to zero —
    // a bug upstream (e.g. in the balance engine), not a normal case.
    throw new ValidationError("Balances do not net to zero; cannot optimize settlements", {
      totalCredit,
      totalDebt,
    });
  }

  const transactions: SettlementTransaction[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const amount = Math.min(creditor.balance, debtor.balance);

    if (amount > 0) {
      transactions.push({ from: debtor.userId, to: creditor.userId, amount });
    }

    creditor.balance -= amount;
    debtor.balance -= amount;

    if (creditor.balance === 0) i++;
    if (debtor.balance === 0) j++;
  }

  return transactions;
}

function byBalanceDescThenId(a: { balance: number; userId: string }, b: { balance: number; userId: string }) {
  return b.balance - a.balance || a.userId.localeCompare(b.userId);
}
