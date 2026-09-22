/**
 * The balance engine: turns a group's expenses (and any recorded
 * settlements) into each member's net balance.
 *
 * Convention:
 *   positive balance -> this person should RECEIVE money (net creditor)
 *   negative balance -> this person OWES money (net debtor)
 *   zero              -> settled up
 *
 * Deliberately has no knowledge of Express or the database — it's a
 * pure function over plain data, so it's trivial to unit test and
 * safe to reuse (e.g. from a future "preview my split" endpoint).
 */

export interface BalanceExpenseInput {
  paidBy: string;
  /** Total amount of the expense, in integer minor units. */
  amount: number;
  /** Each participant's resolved share, in integer minor units. */
  participants: Array<{ userId: string; amount: number }>;
}

export interface BalanceSettlementInput {
  fromUserId: string;
  toUserId: string;
  /** Amount actually paid, in integer minor units. */
  amount: number;
}

export interface MemberBalance {
  userId: string;
  /** Integer minor units. Positive = owed money, negative = owes money. */
  balance: number;
}

export function calculateBalances(params: {
  memberIds: string[];
  expenses: BalanceExpenseInput[];
  settlements?: BalanceSettlementInput[];
}): MemberBalance[] {
  const balances = new Map<string, number>();

  const credit = (userId: string, amount: number) => {
    balances.set(userId, (balances.get(userId) ?? 0) + amount);
  };
  const debit = (userId: string, amount: number) => {
    balances.set(userId, (balances.get(userId) ?? 0) - amount);
  };

  // Seed every known member at zero, so someone with no expenses still
  // shows up as settled rather than being silently omitted.
  for (const id of params.memberIds) {
    balances.set(id, 0);
  }

  for (const expense of params.expenses) {
    // Payer fronted the whole amount -> credited the full amount.
    credit(expense.paidBy, expense.amount);
    // Each participant owes their resolved share.
    for (const p of expense.participants) {
      debit(p.userId, p.amount);
    }
  }

  for (const settlement of params.settlements ?? []) {
    // fromUserId actually paid toUserId -> fromUserId's debt shrinks
    // (balance moves toward zero / positive), toUserId's credit shrinks.
    credit(settlement.fromUserId, settlement.amount);
    debit(settlement.toUserId, settlement.amount);
  }

  // Union memberIds with any id that showed up in expenses/settlements
  // but wasn't in memberIds (e.g. a member later removed from the
  // group) — better to surface an unexpected balance than silently
  // drop it.
  const allIds = new Set(params.memberIds);
  for (const e of params.expenses) {
    allIds.add(e.paidBy);
    for (const p of e.participants) allIds.add(p.userId);
  }
  for (const s of params.settlements ?? []) {
    allIds.add(s.fromUserId);
    allIds.add(s.toUserId);
  }

  return Array.from(allIds).map((userId) => ({
    userId,
    balance: balances.get(userId) ?? 0,
  }));
}
