import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export function createSqliteDatabase(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // WAL mode for high performance concurrency
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      text TEXT NOT NULL,
      media_type TEXT,
      media_mime_type TEXT,
      quoted_message_id TEXT,
      quoted_text TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_group_timestamp 
    ON messages(group_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      title TEXT NOT NULL,
      assignee TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_group_status 
    ON tickets(group_id, status);

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      target_time INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      target_user TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reminders_status_time 
    ON reminders(is_completed, target_time ASC);
  `);

  return db;
}
