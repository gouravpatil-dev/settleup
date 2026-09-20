import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

let db: Database.Database | null = null;

/**
 * Returns a singleton SQLite connection. In tests, DATABASE_PATH is
 * set to ":memory:" so each test process gets an isolated database.
 */
export function getDb(): Database.Database {
  if (db) return db;

  if (env.DATABASE_PATH !== ":memory:") {
    const dir = path.dirname(env.DATABASE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  db = new Database(env.DATABASE_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
