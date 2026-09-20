import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ExpenseParticipantRow, ExpenseRow, PublicExpense, SplitType } from "../types/domain.js";
import type { SplitResult } from "../services/splitCalculator.js";

function toPublicExpense(row: ExpenseRow, participants: ExpenseParticipantRow[]): PublicExpense {
  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    paidBy: row.paid_by,
    splitType: row.split_type,
    date: row.expense_date,
    category: row.category,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participants: participants.map((p) => ({
      userId: p.user_id,
      amount: p.share_amount,
      percentage: p.percentage,
      shares: p.shares,
    })),
  };
}

export class ExpenseRepository {
  constructor(private readonly db: Database.Database) {}

  createWithParticipants(params: {
    groupId: string;
    description: string;
    amount: number;
    currency: string;
    paidBy: string;
    splitType: SplitType;
    date: string;
    category?: string;
    notes?: string;
    splits: SplitResult[];
  }): PublicExpense {
    const expenseId = randomUUID();

    const run = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO expenses
             (id, group_id, description, amount, currency, paid_by, split_type, expense_date, category, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          expenseId,
          params.groupId,
          params.description,
          params.amount,
          params.currency,
          params.paidBy,
          params.splitType,
          params.date,
          params.category ?? null,
          params.notes ?? null
        );

      const insertParticipant = this.db.prepare(
        `INSERT INTO expense_participants (id, expense_id, user_id, share_amount, percentage, shares)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const split of params.splits) {
        insertParticipant.run(
          randomUUID(),
          expenseId,
          split.userId,
          split.amount,
          split.percentage,
          split.shares
        );
      }
    });

    run();
    return this.findById(expenseId)!;
  }

  findById(id: string): PublicExpense | undefined {
    const row = this.db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as
      | ExpenseRow
      | undefined;
    if (!row) return undefined;

    const participants = this.db
      .prepare("SELECT * FROM expense_participants WHERE expense_id = ?")
      .all(id) as ExpenseParticipantRow[];

    return toPublicExpense(row, participants);
  }

  listForGroup(groupId: string): PublicExpense[] {
    const rows = this.db
      .prepare("SELECT * FROM expenses WHERE group_id = ? ORDER BY expense_date DESC, created_at DESC")
      .all(groupId) as ExpenseRow[];

    const participantStmt = this.db.prepare(
      "SELECT * FROM expense_participants WHERE expense_id = ?"
    );

    return rows.map((row) =>
      toPublicExpense(row, participantStmt.all(row.id) as ExpenseParticipantRow[])
    );
  }
}
