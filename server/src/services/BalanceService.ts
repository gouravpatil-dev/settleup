import type Database from "better-sqlite3";
import { ExpenseRepository } from "../repositories/ExpenseRepository.js";
import { GroupMemberRepository } from "../repositories/GroupMemberRepository.js";
import { requireGroupMembership } from "../utils/requireMembership.js";
import { calculateBalances, type MemberBalance } from "../algorithm/balanceCalculator.js";

export interface GroupMemberBalance extends MemberBalance {
  name: string | null;
  email: string | null;
}

export class BalanceService {
  private readonly members: GroupMemberRepository;
  private readonly expenses: ExpenseRepository;

  constructor(db: Database.Database) {
    this.members = new GroupMemberRepository(db);
    this.expenses = new ExpenseRepository(db);
  }

  getGroupBalances(groupId: string, requesterId: string): GroupMemberBalance[] {
    requireGroupMembership(this.members, groupId, requesterId);

    const memberRows = this.members.listForGroup(groupId);
    const expenseRows = this.expenses.listForGroup(groupId);

    // No settlement persistence exists yet (that lands with Phase 7's
    // "mark as paid" flow) — the engine already accepts settlements,
    // so wiring real ones in later is additive, not a rewrite.
    const balances = calculateBalances({
      memberIds: memberRows.map((m) => m.userId),
      expenses: expenseRows.map((e) => ({
        paidBy: e.paidBy,
        amount: e.amount,
        participants: e.participants.map((p) => ({ userId: p.userId, amount: p.amount })),
      })),
      settlements: [],
    });

    const infoByUserId = new Map(memberRows.map((m) => [m.userId, m]));

    return balances.map((b) => ({
      ...b,
      name: infoByUserId.get(b.userId)?.name ?? null,
      email: infoByUserId.get(b.userId)?.email ?? null,
    }));
  }
}
