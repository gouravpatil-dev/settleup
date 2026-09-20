import type Database from "better-sqlite3";
import { ExpenseRepository } from "../repositories/ExpenseRepository.js";
import { GroupMemberRepository } from "../repositories/GroupMemberRepository.js";
import { NotFoundError, ValidationError } from "../utils/AppError.js";
import { calculateSplit, type SplitParticipantsInput } from "./splitCalculator.js";
import type { PublicExpense } from "../types/domain.js";

export interface CreateExpenseInput {
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  date: string;
  category?: string;
  notes?: string;
  split: SplitParticipantsInput;
}

export class ExpenseService {
  private readonly expenses: ExpenseRepository;
  private readonly members: GroupMemberRepository;

  constructor(db: Database.Database) {
    this.expenses = new ExpenseRepository(db);
    this.members = new GroupMemberRepository(db);
  }

  /** Throws NotFoundError if the requester isn't a member — same shape as group access checks elsewhere. */
  private requireMembership(groupId: string, userId: string): void {
    const membership = this.members.findMembership(groupId, userId);
    if (!membership) {
      throw new NotFoundError("Group");
    }
  }

  private assertAllMembersOfGroup(groupId: string, userIds: string[]): void {
    for (const userId of userIds) {
      if (!this.members.findMembership(groupId, userId)) {
        throw new ValidationError("All participants must belong to the group", { userId });
      }
    }
  }

  createExpense(groupId: string, requesterId: string, input: CreateExpenseInput): PublicExpense {
    this.requireMembership(groupId, requesterId);

    const participantIds = input.split.participants.map((p) => p.userId);
    this.assertAllMembersOfGroup(groupId, [input.paidBy, ...participantIds]);

    const splits = calculateSplit(input.amount, input.split);

    return this.expenses.createWithParticipants({
      groupId,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      paidBy: input.paidBy,
      splitType: input.split.splitType,
      date: input.date,
      category: input.category,
      notes: input.notes,
      splits,
    });
  }

  listExpensesForGroup(groupId: string, requesterId: string): PublicExpense[] {
    this.requireMembership(groupId, requesterId);
    return this.expenses.listForGroup(groupId);
  }

  getExpense(groupId: string, expenseId: string, requesterId: string): PublicExpense {
    this.requireMembership(groupId, requesterId);
    const expense = this.expenses.findById(expenseId);
    if (!expense || expense.groupId !== groupId) {
      throw new NotFoundError("Expense");
    }
    return expense;
  }
}
