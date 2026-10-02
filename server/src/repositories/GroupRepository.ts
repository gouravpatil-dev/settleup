import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { GroupRow, PublicGroup } from "../types/domain.js";

function toPublicGroup(row: GroupRow): PublicGroup {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class GroupRepository {
  constructor(private readonly db: Database.Database) {}

  create(params: { name: string; createdBy: string }): PublicGroup {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)")
      .run(id, params.name, params.createdBy);
    return this.findById(id)!;
  }

  findById(id: string): PublicGroup | undefined {
    const row = this.db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as
      | GroupRow
      | undefined;
    return row ? toPublicGroup(row) : undefined;
  }

  /** Groups the given user belongs to (as owner or member). */
  listForUser(userId: string): PublicGroup[] {
    const rows = this.db
      .prepare(
        `SELECT g.* FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = ?
         ORDER BY g.created_at DESC`
      )
      .all(userId) as GroupRow[];
    return rows.map(toPublicGroup);
  }

  rename(id: string, name: string): PublicGroup {
    this.db
      .prepare("UPDATE groups SET name = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name, id);
    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM groups WHERE id = ?").run(id);
  }
}
