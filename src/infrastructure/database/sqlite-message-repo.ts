import Database from 'better-sqlite3';
import { IMessageRepository } from '../../domain/repositories/message-repo.js';
import { GroupMessage, MediaType } from '../../domain/models/message.js';

interface MessageRow {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  media_type: string | null;
  media_mime_type: string | null;
  quoted_message_id: string | null;
  quoted_text: string | null;
  timestamp: number;
}

export class SqliteMessageRepository implements IMessageRepository {
  private insertStmt: Database.Statement;
  private selectRecentStmt: Database.Statement;
  private selectByIdStmt: Database.Statement;
  private existsStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages (
        id, group_id, sender_id, sender_name, text, media_type, media_mime_type, quoted_message_id, quoted_text, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.selectRecentStmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE group_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    this.selectByIdStmt = this.db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `);

    this.existsStmt = this.db.prepare(`
      SELECT 1 FROM messages WHERE id = ?
    `);
  }

  save(message: GroupMessage): void {
    this.insertStmt.run(
      message.id,
      message.groupId,
      message.senderId,
      message.senderName,
      message.text,
      message.mediaType || 'text',
      message.mediaMimeType || null,
      message.quotedMessageId || null,
      message.quotedText || null,
      message.timestamp
    );
  }

  getRecentByGroup(groupId: string, limit = 50): GroupMessage[] {
    const rows = this.selectRecentStmt.all(groupId, limit) as MessageRow[];
    // Return in chronological order (oldest first)
    return rows.reverse().map(this.mapRowToModel);
  }

  getById(id: string): GroupMessage | null {
    const row = this.selectByIdStmt.get(id) as MessageRow | undefined;
    if (!row) return null;
    return this.mapRowToModel(row);
  }

  exists(id: string): boolean {
    return !!this.existsStmt.get(id);
  }

  private mapRowToModel(row: MessageRow): GroupMessage {
    return {
      id: row.id,
      groupId: row.group_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      text: row.text,
      mediaType: (row.media_type as MediaType) || 'text',
      mediaMimeType: row.media_mime_type || undefined,
      quotedMessageId: row.quoted_message_id || undefined,
      quotedText: row.quoted_text || undefined,
      timestamp: row.timestamp,
    };
  }
}
