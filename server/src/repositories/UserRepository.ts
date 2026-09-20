import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { PublicUser, UserRow } from "../types/domain.js";

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  findByEmail(email: string): UserRow | undefined {
    return this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.toLowerCase()) as UserRow | undefined;
  }

  findById(id: string): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  }

  create(params: { email: string; name: string; passwordHash: string }): UserRow {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)")
      .run(id, params.email.toLowerCase(), params.name, params.passwordHash);
    return this.findById(id)!;
  }
}
