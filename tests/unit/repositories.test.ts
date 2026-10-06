import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSqliteDatabase } from '../../src/infrastructure/database/sqlite-client.js';
import { SqliteMessageRepository } from '../../src/infrastructure/database/sqlite-message-repo.js';
import { SqliteTicketRepository } from '../../src/infrastructure/database/sqlite-ticket-repo.js';
import { SqliteReminderRepository } from '../../src/infrastructure/database/sqlite-reminder-repo.js';
import { GroupMessage } from '../../src/domain/models/message.js';
import { Ticket } from '../../src/domain/models/ticket.js';
import { Reminder } from '../../src/domain/models/reminder.js';

describe('Phase 1: SQLite Repositories Unit Tests', () => {
  let db: Database.Database;
  let messageRepo: SqliteMessageRepository;
  let ticketRepo: SqliteTicketRepository;
  let reminderRepo: SqliteReminderRepository;

  beforeEach(() => {
    // Isolated in-memory database for every test
    db = createSqliteDatabase(':memory:');
    messageRepo = new SqliteMessageRepository(db);
    ticketRepo = new SqliteTicketRepository(db);
    reminderRepo = new SqliteReminderRepository(db);
  });

  describe('SqliteMessageRepository', () => {
    it('should save and retrieve a message by id', () => {
      const msg: GroupMessage = {
        id: 'msg-001',
        groupId: 'group-101',
        senderId: 'user-ravi',
        senderName: 'Ravi',
        text: 'Vendor A is cheaper but B delivers in 2 days',
        timestamp: Date.now(),
      };

      messageRepo.save(msg);

      expect(messageRepo.exists('msg-001')).toBe(true);
      expect(messageRepo.exists('non-existent')).toBe(false);

      const retrieved = messageRepo.getById('msg-001');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.text).toBe('Vendor A is cheaper but B delivers in 2 days');
      expect(retrieved?.senderName).toBe('Ravi');
    });

    it('should retrieve recent messages in chronological order (oldest to newest)', () => {
      const now = Date.now();
      const messages: GroupMessage[] = [
        {
          id: 'msg-1',
          groupId: 'group-1',
          senderId: 'u1',
          senderName: 'Ravi',
          text: 'First message',
          timestamp: now - 3000,
        },
        {
          id: 'msg-2',
          groupId: 'group-1',
          senderId: 'u2',
          senderName: 'Priya',
          text: 'Second message',
          timestamp: now - 2000,
        },
        {
          id: 'msg-3',
          groupId: 'group-1',
          senderId: 'u1',
          senderName: 'Ravi',
          text: 'Third message',
          timestamp: now - 1000,
        },
      ];

      for (const m of messages) {
        messageRepo.save(m);
      }

      const recent = messageRepo.getRecentByGroup('group-1', 10);
      expect(recent.length).toBe(3);
      expect(recent[0].id).toBe('msg-1');
      expect(recent[1].id).toBe('msg-2');
      expect(recent[2].id).toBe('msg-3');
    });
  });

  describe('SqliteTicketRepository', () => {
    it('should generate sequential ticket IDs and save tickets', () => {
      const id1 = ticketRepo.getNextTicketId('group-1');
      expect(id1).toBe('OPS-1');

      const ticket1: Ticket = {
        id: id1,
        groupId: 'group-1',
        title: 'Send Acme Invoice',
        assignee: 'Kiran',
        priority: 'P1',
        dueDate: 'Fri 3 Oct',
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      ticketRepo.save(ticket1);

      const id2 = ticketRepo.getNextTicketId('group-1');
      expect(id2).toBe('OPS-2');
    });

    it('should update ticket status', () => {
      const ticket: Ticket = {
        id: 'OPS-14',
        groupId: 'group-1',
        title: 'Send Acme invoice',
        assignee: 'Kiran',
        priority: 'P1',
        dueDate: 'Fri 3 Oct',
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      ticketRepo.save(ticket);

      const updated = ticketRepo.updateStatus('OPS-14', 'done');
      expect(updated?.status).toBe('done');

      const retrieved = ticketRepo.getById('OPS-14');
      expect(retrieved?.status).toBe('done');
    });

    it('should filter tickets by status', () => {
      const t1: Ticket = {
        id: 'OPS-1',
        groupId: 'g1',
        title: 'Task 1',
        assignee: 'Alice',
        priority: 'P1',
        status: 'open',
        createdAt: 100,
        updatedAt: 100,
      };
      const t2: Ticket = {
        id: 'OPS-2',
        groupId: 'g1',
        title: 'Task 2',
        assignee: 'Bob',
        priority: 'P2',
        status: 'done',
        createdAt: 200,
        updatedAt: 200,
      };
      ticketRepo.save(t1);
      ticketRepo.save(t2);

      const openTickets = ticketRepo.getByGroup('g1', 'open');
      expect(openTickets.length).toBe(1);
      expect(openTickets[0].id).toBe('OPS-1');
    });
  });

  describe('SqliteReminderRepository', () => {
    it('should save and return pending reminders sorted by target time', () => {
      const now = Date.now();
      const r1: Reminder = {
        id: 'rem-1',
        groupId: 'g1',
        targetTime: now + 50000,
        prompt: 'Reminder 2 (later)',
        isCompleted: false,
        createdAt: now,
      };
      const r2: Reminder = {
        id: 'rem-2',
        groupId: 'g1',
        targetTime: now + 10000,
        prompt: 'Reminder 1 (sooner)',
        isCompleted: false,
        createdAt: now,
      };
      reminderRepo.save(r1);
      reminderRepo.save(r2);

      const pending = reminderRepo.getPending();
      expect(pending.length).toBe(2);
      expect(pending[0].id).toBe('rem-2'); // Sooner first
      expect(pending[1].id).toBe('rem-1');

      // Mark completed
      reminderRepo.markCompleted('rem-2');
      const updatedPending = reminderRepo.getPending();
      expect(updatedPending.length).toBe(1);
      expect(updatedPending[0].id).toBe('rem-1');
    });
  });
});
