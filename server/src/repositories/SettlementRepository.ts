import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { SettlementRow } from "../types/domain.js";

export class SettlementRepository {
  constructor(private readonly db: Database.Database) {}

  create(params: {
    groupId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    date: string;
    note?: string;
    recordedBy: string;
  }): SettlementRow {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO settlements
           (id, group_id, from_user_id, to_user_id, amount, settled_date, note, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        params.groupId,
        params.fromUserId,
        params.toUserId,
        params.amount,
        params.date,
        params.note ?? null,
        params.recordedBy
      );
    return this.findById(id)!;
  }

  findById(id: string): SettlementRow | undefined {
    return this.db.prepare("SELECT * FROM settlements WHERE id = ?").get(id) as
      | SettlementRow
      | undefined;
  }

  listForGroup(groupId: string): SettlementRow[] {
    return this.db
      .prepare(
        "SELECT * FROM settlements WHERE group_id = ? ORDER BY settled_date DESC, created_at DESC"
      )
      .all(groupId) as SettlementRow[];
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM settlements WHERE id = ?").run(id);
  }
}
