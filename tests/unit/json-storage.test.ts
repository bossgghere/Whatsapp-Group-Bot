import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  JsonFileDatabase,
  JsonMessageRepository,
  JsonTicketRepository,
  JsonReminderRepository,
} from '../../src/infrastructure/storage/json-storage.js';
import { GroupMessage } from '../../src/domain/models/message.js';
import { Ticket } from '../../src/domain/models/ticket.js';
import { Reminder } from '../../src/domain/models/reminder.js';

describe('JSON Storage Repositories Unit Tests', () => {
  const testDbPath = path.join(process.cwd(), 'tests', 'fixtures', 'test_store.json');
  let db: JsonFileDatabase;
  let messageRepo: JsonMessageRepository;
  let ticketRepo: JsonTicketRepository;
  let reminderRepo: JsonReminderRepository;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new JsonFileDatabase(testDbPath);
    messageRepo = new JsonMessageRepository(db);
    ticketRepo = new JsonTicketRepository(db);
    reminderRepo = new JsonReminderRepository(db);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('JsonMessageRepository', () => {
    it('should save and retrieve message by id', () => {
      const msg: GroupMessage = {
        id: 'msg-001',
        groupId: 'group-101',
        senderId: 'user-ravi',
        senderName: 'Ravi',
        text: 'Testing JSON storage save and retrieve',
        timestamp: Date.now(),
      };

      messageRepo.save(msg);
      expect(messageRepo.exists('msg-001')).toBe(true);
      expect(messageRepo.exists('none')).toBe(false);

      const retrieved = messageRepo.getById('msg-001');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.text).toBe('Testing JSON storage save and retrieve');
    });

    it('should retrieve recent messages in chronological order', () => {
      const now = Date.now();
      messageRepo.save({
        id: 'msg-1',
        groupId: 'grp-1',
        senderId: 'u1',
        senderName: 'A',
        text: 'First',
        timestamp: now - 2000,
      });
      messageRepo.save({
        id: 'msg-2',
        groupId: 'grp-1',
        senderId: 'u2',
        senderName: 'B',
        text: 'Second',
        timestamp: now - 1000,
      });

      const recent = messageRepo.getRecentByGroup('grp-1', 10);
      expect(recent.length).toBe(2);
      expect(recent[0].id).toBe('msg-1');
      expect(recent[1].id).toBe('msg-2');
    });
  });

  describe('JsonTicketRepository', () => {
    it('should generate sequential ticket IDs and save tickets', () => {
      const id1 = ticketRepo.getNextTicketId('grp-1');
      expect(id1).toBe('OPS-1');

      const ticket1: Ticket = {
        id: id1,
        groupId: 'grp-1',
        title: 'Review invoice',
        assignee: 'Kiran',
        priority: 'P1',
        dueDate: 'Tomorrow',
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      ticketRepo.save(ticket1);
      const id2 = ticketRepo.getNextTicketId('grp-1');
      expect(id2).toBe('OPS-2');

      const retrieved = ticketRepo.getById('OPS-1');
      expect(retrieved?.title).toBe('Review invoice');
    });

    it('should update ticket status', () => {
      ticketRepo.save({
        id: 'OPS-1',
        groupId: 'grp-1',
        title: 'Task',
        assignee: 'Someone',
        priority: 'P2',
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const updated = ticketRepo.updateStatus('OPS-1', 'done');
      expect(updated?.status).toBe('done');
    });
  });

  describe('JsonReminderRepository', () => {
    it('should save, retrieve pending, and mark completed', () => {
      const rem: Reminder = {
        id: 'rem-1',
        groupId: 'grp-1',
        targetUser: 'Alice',
        prompt: 'Standup call',
        targetTime: Date.now() + 50000,
        isCompleted: false,
        createdAt: Date.now(),
      };

      reminderRepo.save(rem);
      const pending = reminderRepo.getPending();
      expect(pending.length).toBe(1);
      expect(pending[0].prompt).toBe('Standup call');

      reminderRepo.markCompleted('rem-1');
      expect(reminderRepo.getPending().length).toBe(0);
    });
  });
});
