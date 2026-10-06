import Database from 'better-sqlite3';
import { IReminderRepository } from '../../domain/repositories/reminder-repo.js';
import { Reminder } from '../../domain/models/reminder.js';

interface ReminderRow {
  id: string;
  group_id: string;
  target_time: number;
  prompt: string;
  target_user: string | null;
  is_completed: number;
  created_at: number;
}

export class SqliteReminderRepository implements IReminderRepository {
  private insertStmt: Database.Statement;
  private selectByIdStmt: Database.Statement;
  private selectPendingStmt: Database.Statement;
  private selectByGroupStmt: Database.Statement;
  private markCompletedStmt: Database.Statement;
  private deleteStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO reminders (
        id, group_id, target_time, prompt, target_user, is_completed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.selectByIdStmt = this.db.prepare(`
      SELECT * FROM reminders WHERE id = ?
    `);

    this.selectPendingStmt = this.db.prepare(`
      SELECT * FROM reminders WHERE is_completed = 0 ORDER BY target_time ASC
    `);

    this.selectByGroupStmt = this.db.prepare(`
      SELECT * FROM reminders WHERE group_id = ? ORDER BY target_time ASC
    `);

    this.markCompletedStmt = this.db.prepare(`
      UPDATE reminders SET is_completed = 1 WHERE id = ?
    `);

    this.deleteStmt = this.db.prepare(`
      DELETE FROM reminders WHERE id = ?
    `);
  }

  save(reminder: Reminder): void {
    this.insertStmt.run(
      reminder.id,
      reminder.groupId,
      reminder.targetTime,
      reminder.prompt,
      reminder.targetUser || null,
      reminder.isCompleted ? 1 : 0,
      reminder.createdAt
    );
  }

  getById(id: string): Reminder | null {
    const row = this.selectByIdStmt.get(id) as ReminderRow | undefined;
    if (!row) return null;
    return this.mapRowToModel(row);
  }

  getPending(): Reminder[] {
    const rows = this.selectPendingStmt.all() as ReminderRow[];
    return rows.map(this.mapRowToModel);
  }

  getByGroup(groupId: string): Reminder[] {
    const rows = this.selectByGroupStmt.all(groupId) as ReminderRow[];
    return rows.map(this.mapRowToModel);
  }

  markCompleted(id: string): void {
    this.markCompletedStmt.run(id);
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }

  private mapRowToModel(row: ReminderRow): Reminder {
    return {
      id: row.id,
      groupId: row.group_id,
      targetTime: row.target_time,
      prompt: row.prompt,
      targetUser: row.target_user || undefined,
      isCompleted: row.is_completed === 1,
      createdAt: row.created_at,
    };
  }
}
