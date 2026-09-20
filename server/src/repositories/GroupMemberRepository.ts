import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { GroupMemberRow, GroupMemberWithUser, GroupRole } from "../types/domain.js";

export class GroupMemberRepository {
  constructor(private readonly db: Database.Database) {}

  add(params: { groupId: string; userId: string; role: GroupRole }): GroupMemberRow {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, ?)"
      )
      .run(id, params.groupId, params.userId, params.role);
    return this.db.prepare("SELECT * FROM group_members WHERE id = ?").get(id) as GroupMemberRow;
  }

  findMembership(groupId: string, userId: string): GroupMemberRow | undefined {
    return this.db
      .prepare("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?")
      .get(groupId, userId) as GroupMemberRow | undefined;
  }

  listForGroup(groupId: string): GroupMemberWithUser[] {
    const rows = this.db
      .prepare(
        `SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.joined_at, u.name, u.email
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY gm.joined_at ASC`
      )
      .all(groupId) as Array<{
      id: string;
      group_id: string;
      user_id: string;
      role: GroupRole;
      joined_at: string;
      name: string;
      email: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      groupId: r.group_id,
      userId: r.user_id,
      role: r.role,
      joinedAt: r.joined_at,
      name: r.name,
      email: r.email,
    }));
  }

  remove(groupId: string, userId: string): void {
    this.db
      .prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?")
      .run(groupId, userId);
  }

  countOwners(groupId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as c FROM group_members WHERE group_id = ? AND role = 'owner'")
      .get(groupId) as { c: number };
    return row.c;
  }
}
