import fs from 'fs';
import path from 'path';
import { IMessageRepository } from '../../domain/repositories/message-repo.js';
import { ITicketRepository } from '../../domain/repositories/ticket-repo.js';
import { IReminderRepository } from '../../domain/repositories/reminder-repo.js';
import { GroupMessage } from '../../domain/models/message.js';
import { Ticket, TicketStatus } from '../../domain/models/ticket.js';
import { Reminder } from '../../domain/models/reminder.js';

interface DatabaseSchema {
  messages: GroupMessage[];
  tickets: Ticket[];
  reminders: Reminder[];
}

export class JsonFileDatabase {
  private filePath: string;
  private data: DatabaseSchema = { messages: [], tickets: [], reminders: [] };

  constructor(filePath: string) {
    this.filePath = filePath;
    this.init();
  }

  private init(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.messages) this.data.messages = [];
        if (!this.data.tickets) this.data.tickets = [];
        if (!this.data.reminders) this.data.reminders = [];
      } catch (err) {
        console.warn('[JsonStorage] Corrupted storage file, resetting:', err);
        this.persist();
      }
    } else {
      this.persist();
    }
  }

  public persist(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[JsonStorage] Error persisting to disk:', err);
    }
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  public close(): void {
    this.persist();
  }
}

export class JsonMessageRepository implements IMessageRepository {
  constructor(private db: JsonFileDatabase) {}

  save(message: GroupMessage): void {
    const data = this.db.getData();
    const index = data.messages.findIndex((m) => m.id === message.id);
    if (index >= 0) {
      data.messages[index] = message;
    } else {
      data.messages.push(message);
      // Keep last 1,000 messages to prevent unbounded file growth
      if (data.messages.length > 1000) {
        data.messages.shift();
      }
    }
    this.db.persist();
  }

  getRecentByGroup(groupId: string, limit = 50): GroupMessage[] {
    const data = this.db.getData();
    const groupMsgs = data.messages
      .filter((m) => m.groupId === groupId)
      .sort((a, b) => a.timestamp - b.timestamp);

    return groupMsgs.slice(-limit);
  }

  getById(id: string): GroupMessage | null {
    const found = this.db.getData().messages.find((m) => m.id === id);
    return found || null;
  }

  exists(id: string): boolean {
    return this.db.getData().messages.some((m) => m.id === id);
  }
}

export class JsonTicketRepository implements ITicketRepository {
  constructor(private db: JsonFileDatabase) {}

  save(ticket: Ticket): void {
    const data = this.db.getData();
    const index = data.tickets.findIndex((t) => t.id === ticket.id);
    if (index >= 0) {
      data.tickets[index] = ticket;
    } else {
      data.tickets.push(ticket);
    }
    this.db.persist();
  }

  getById(id: string): Ticket | null {
    const found = this.db.getData().tickets.find((t) => t.id === id);
    return found || null;
  }

  getByGroup(groupId: string, status?: TicketStatus): Ticket[] {
    const data = this.db.getData();
    return data.tickets
      .filter((t) => t.groupId === groupId && (status ? t.status === status : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  updateStatus(id: string, status: TicketStatus): Ticket | null {
    const data = this.db.getData();
    const ticket = data.tickets.find((t) => t.id === id);
    if (!ticket) return null;

    ticket.status = status;
    ticket.updatedAt = Date.now();
    this.db.persist();
    return ticket;
  }

  getNextTicketId(groupId: string): string {
    const groupTickets = this.db.getData().tickets.filter((t) => t.groupId === groupId);
    const nextNum = groupTickets.length + 1;
    return `OPS-${nextNum}`;
  }
}

export class JsonReminderRepository implements IReminderRepository {
  constructor(private db: JsonFileDatabase) {}

  save(reminder: Reminder): void {
    const data = this.db.getData();
    const index = data.reminders.findIndex((r) => r.id === reminder.id);
    if (index >= 0) {
      data.reminders[index] = reminder;
    } else {
      data.reminders.push(reminder);
    }
    this.db.persist();
  }

  getById(id: string): Reminder | null {
    const found = this.db.getData().reminders.find((r) => r.id === id);
    return found || null;
  }

  getPending(): Reminder[] {
    const data = this.db.getData();
    return data.reminders
      .filter((r) => !r.isCompleted)
      .sort((a, b) => a.targetTime - b.targetTime);
  }

  getByGroup(groupId: string): Reminder[] {
    const data = this.db.getData();
    return data.reminders
      .filter((r) => r.groupId === groupId)
      .sort((a, b) => a.targetTime - b.targetTime);
  }

  markCompleted(id: string): void {
    const reminder = this.db.getData().reminders.find((r) => r.id === id);
    if (reminder) {
      reminder.isCompleted = true;
      this.db.persist();
    }
  }

  delete(id: string): void {
    const data = this.db.getData();
    data.reminders = data.reminders.filter((r) => r.id !== id);
    this.db.persist();
  }
}
