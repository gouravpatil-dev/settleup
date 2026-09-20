import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { SessionRow } from "../types/domain.js";

export class SessionRepository {
  constructor(private readonly db: Database.Database) {}

  create(userId: string, ttlMs: number): SessionRow {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.db
      .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .run(id, userId, expiresAt);
    return { id, user_id: userId, expires_at: expiresAt, created_at: new Date().toISOString() };
  }

  /** Returns the session only if it exists and has not expired. */
  findValid(id: string): SessionRow | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
      | SessionRow
      | undefined;
    if (!row) return undefined;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      this.delete(id);
      return undefined;
    }
    return row;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  deleteAllForUser(userId: string): void {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
}
