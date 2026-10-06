import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createSqliteDatabase } from '../../src/infrastructure/database/sqlite-client.js';
import { SqliteMessageRepository } from '../../src/infrastructure/database/sqlite-message-repo.js';
import { SqliteTicketRepository } from '../../src/infrastructure/database/sqlite-ticket-repo.js';
import { SqliteReminderRepository } from '../../src/infrastructure/database/sqlite-reminder-repo.js';
import { RecordMessageUseCase } from '../../src/application/use-cases/record-message.usecase.js';
import { ManageTicketsUseCase } from '../../src/application/use-cases/manage-tickets.usecase.js';
import { ManageRemindersUseCase } from '../../src/application/use-cases/manage-reminders.usecase.js';
import { TimerSchedulerService } from '../../src/infrastructure/scheduler/timer-scheduler.js';

describe('Phase 3 & 4: Application Use Cases & Scheduler Unit Tests', () => {
  let db: Database.Database;
  let messageRepo: SqliteMessageRepository;
  let ticketRepo: SqliteTicketRepository;
  let reminderRepo: SqliteReminderRepository;
  let scheduler: TimerSchedulerService;

  beforeEach(() => {
    db = createSqliteDatabase(':memory:');
    messageRepo = new SqliteMessageRepository(db);
    ticketRepo = new SqliteTicketRepository(db);
    reminderRepo = new SqliteReminderRepository(db);
    scheduler = new TimerSchedulerService();
  });

  describe('RecordMessageUseCase', () => {
    it('should record new message and deduplicate repeated message ID', () => {
      const uc = new RecordMessageUseCase(messageRepo);
      const msg = {
        id: 'msg-abc',
        groupId: 'grp-1',
        senderId: 'user1',
        senderName: 'Alice',
        text: 'Hello world',
        timestamp: Date.now(),
      };

      const firstResult = uc.execute(msg);
      expect(firstResult).toBe(true);

      const secondResult = uc.execute(msg);
      expect(secondResult).toBe(false); // Deduplicated!
    });
  });

  describe('ManageTicketsUseCase', () => {
    it('should create ticket, list tickets, and close ticket cleanly', () => {
      const uc = new ManageTicketsUseCase(ticketRepo);

      const ticket = uc.createTicket({
        groupId: 'grp-1',
        title: 'Send Acme invoice',
        assignee: 'Kiran',
        priority: 'P1',
        dueDate: 'Fri 3 Oct',
      });

      expect(ticket.id).toBe('OPS-1');
      expect(ticket.status).toBe('open');

      const reply = uc.formatTicketCreatedReply(ticket);
      expect(reply).toContain('[OPS-1]');
      expect(reply).toContain('Kiran');

      const listOutput = uc.listTickets('grp-1', 'open');
      expect(listOutput).toContain('OPS-1');

      const closeResult = uc.closeTicket('OPS-1', 'Kiran');
      expect(closeResult.success).toBe(true);
      expect(closeResult.message).toContain('closed by *Kiran*');

      const emptyList = uc.listTickets('grp-1', 'open');
      expect(emptyList).toContain('No open tickets');
    });
  });

  describe('ManageRemindersUseCase & TimerScheduler', () => {
    it('should schedule reminder and trigger callback', async () => {
      vi.useFakeTimers();

      const reminderUseCase = new ManageRemindersUseCase(reminderRepo, scheduler);
      let firedReminderId: string | null = null;

      const targetTime = Date.now() + 2000;
      const reminder = reminderUseCase.createReminder({
        groupId: 'grp-1',
        targetTimeMs: targetTime,
        prompt: 'Check stock',
        targetUser: 'Ravi',
        onFire: async (fired) => {
          firedReminderId = fired.id;
        },
      });

      expect(reminder.id).toBeDefined();
      expect(scheduler.getActiveTimerCount()).toBe(1);

      // Fast forward time by 2.5 seconds
      await vi.advanceTimersByTimeAsync(2500);

      expect(firedReminderId).toBe(reminder.id);
      expect(scheduler.getActiveTimerCount()).toBe(0);

      // Database should reflect completion
      const pending = reminderRepo.getPending();
      expect(pending.length).toBe(0);

      vi.useRealTimers();
    });
  });
});
