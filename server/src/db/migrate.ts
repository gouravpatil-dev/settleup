import type Database from "better-sqlite3";

interface Migration {
  id: string;
  up: (db: Database.Database) => void;
}

/**
 * Migrations are plain functions, applied in order, tracked in a
 * `migrations` table so re-running init() is idempotent. Amounts are
 * stored as integer minor units (paise) everywhere — never REAL —
 * to avoid floating-point currency bugs later (Phase 4).
 */
const migrations: Migration[] = [
  {
    id: "0001_init",
    up: (db) => {
      db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE group_members (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
          joined_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (group_id, user_id)
        );

        CREATE INDEX idx_group_members_group_id ON group_members(group_id);
        CREATE INDEX idx_group_members_user_id ON group_members(user_id);
        CREATE INDEX idx_groups_created_by ON groups(created_by);
      `);
    },
  },
  {
    id: "0002_sessions",
    up: (db) => {
      db.exec(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
      `);
    },
  },
  {
    id: "0003_expenses",
    up: (db) => {
      db.exec(`
        CREATE TABLE expenses (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK (amount > 0),
          currency TEXT NOT NULL DEFAULT 'INR',
          paid_by TEXT NOT NULL REFERENCES users(id),
          split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
          expense_date TEXT NOT NULL,
          category TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE expense_participants (
          id TEXT PRIMARY KEY,
          expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id),
          share_amount INTEGER NOT NULL CHECK (share_amount >= 0),
          percentage REAL,
          shares INTEGER,
          UNIQUE (expense_id, user_id)
        );

        CREATE INDEX idx_expenses_group_id ON expenses(group_id);
        CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
        CREATE INDEX idx_expense_participants_expense_id ON expense_participants(expense_id);
        CREATE INDEX idx_expense_participants_user_id ON expense_participants(user_id);
      `);
    },
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare("SELECT id FROM migrations").all().map((row) => (row as { id: string }).id)
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    const runMigration = db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO migrations (id) VALUES (?)").run(migration.id);
    });
    runMigration();
    console.log(`Applied migration: ${migration.id}`);
  }
}
