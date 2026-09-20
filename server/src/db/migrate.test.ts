import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
}

describe("runMigrations", () => {
  it("creates the expected Phase 1 tables", () => {
    const db = freshDb();
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name)
      .sort();

    expect(tables).toEqual(
      expect.arrayContaining(["users", "groups", "group_members", "sessions", "migrations"])
    );
  });

  it("is idempotent — running twice does not error or duplicate", () => {
    const db = freshDb();
    runMigrations(db);
    const countAfterFirst = (
      db.prepare("SELECT COUNT(*) as c FROM migrations").get() as { c: number }
    ).c;

    runMigrations(db); // should no-op, not throw or reapply

    const countAfterSecond = (
      db.prepare("SELECT COUNT(*) as c FROM migrations").get() as { c: number }
    ).c;

    expect(countAfterFirst).toBeGreaterThan(0);
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it("enforces unique membership per (group_id, user_id)", () => {
    const db = freshDb();
    runMigrations(db);

    db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").run(
      "u1",
      "a@example.com",
      "Alice",
      "hash"
    );
    db.prepare("INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)").run(
      "g1",
      "Trip",
      "u1"
    );
    db.prepare(
      "INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)"
    ).run("m1", "g1", "u1");

    expect(() =>
      db
        .prepare("INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)")
        .run("m2", "g1", "u1")
    ).toThrow();
  });
});
