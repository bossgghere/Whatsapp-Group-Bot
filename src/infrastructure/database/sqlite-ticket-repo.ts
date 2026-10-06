import Database from 'better-sqlite3';
import { ITicketRepository } from '../../domain/repositories/ticket-repo.js';
import { Ticket, TicketPriority, TicketStatus } from '../../domain/models/ticket.js';

interface TicketRow {
  id: string;
  group_id: string;
  title: string;
  assignee: string;
  priority: string;
  due_date: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export class SqliteTicketRepository implements ITicketRepository {
  private insertStmt: Database.Statement;
  private selectByIdStmt: Database.Statement;
  private selectByGroupStmt: Database.Statement;
  private selectByGroupAndStatusStmt: Database.Statement;
  private updateStatusStmt: Database.Statement;
  private countByGroupStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO tickets (
        id, group_id, title, assignee, priority, due_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.selectByIdStmt = this.db.prepare(`
      SELECT * FROM tickets WHERE id = ?
    `);

    this.selectByGroupStmt = this.db.prepare(`
      SELECT * FROM tickets WHERE group_id = ? ORDER BY created_at DESC
    `);

    this.selectByGroupAndStatusStmt = this.db.prepare(`
      SELECT * FROM tickets WHERE group_id = ? AND status = ? ORDER BY created_at DESC
    `);

    this.updateStatusStmt = this.db.prepare(`
      UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?
    `);

    this.countByGroupStmt = this.db.prepare(`
      SELECT count(*) as total FROM tickets WHERE group_id = ?
    `);
  }

  save(ticket: Ticket): void {
    this.insertStmt.run(
      ticket.id,
      ticket.groupId,
      ticket.title,
      ticket.assignee,
      ticket.priority,
      ticket.dueDate || null,
      ticket.status,
      ticket.createdAt,
      ticket.updatedAt
    );
  }

  getById(id: string): Ticket | null {
    const row = this.selectByIdStmt.get(id) as TicketRow | undefined;
    if (!row) return null;
    return this.mapRowToModel(row);
  }

  getByGroup(groupId: string, status?: TicketStatus): Ticket[] {
    const rows = (
      status
        ? this.selectByGroupAndStatusStmt.all(groupId, status)
        : this.selectByGroupStmt.all(groupId)
    ) as TicketRow[];
    return rows.map(this.mapRowToModel);
  }

  updateStatus(id: string, status: TicketStatus): Ticket | null {
    const now = Date.now();
    const result = this.updateStatusStmt.run(status, now, id);
    if (result.changes === 0) return null;
    return this.getById(id);
  }

  getNextTicketId(groupId: string): string {
    const row = this.countByGroupStmt.get(groupId) as { total: number };
    const nextNum = (row?.total || 0) + 1;
    return `OPS-${nextNum}`;
  }

  private mapRowToModel(row: TicketRow): Ticket {
    return {
      id: row.id,
      groupId: row.group_id,
      title: row.title,
      assignee: row.assignee,
      priority: row.priority as TicketPriority,
      dueDate: row.due_date || undefined,
      status: row.status as TicketStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
