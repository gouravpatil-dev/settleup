import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { GroupRow } from "../types/domain.js";

export class GroupRepository {
  constructor(private readonly db: Database.Database) {}

  create(params: { name: string; createdBy: string }): GroupRow {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)")
      .run(id, params.name, params.createdBy);
    return this.findById(id)!;
  }

  findById(id: string): GroupRow | undefined {
    return this.db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as GroupRow | undefined;
  }

  /** Groups the given user belongs to (as owner or member). */
  listForUser(userId: string): GroupRow[] {
    return this.db
      .prepare(
        `SELECT g.* FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = ?
         ORDER BY g.created_at DESC`
      )
      .all(userId) as GroupRow[];
  }

  rename(id: string, name: string): GroupRow {
    this.db
      .prepare("UPDATE groups SET name = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name, id);
    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM groups WHERE id = ?").run(id);
  }
}
