import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSqliteDatabase } from '../../src/infrastructure/database/sqlite-client.js';
import { SqliteMessageRepository } from '../../src/infrastructure/database/sqlite-message-repo.js';
import { SqliteTicketRepository } from '../../src/infrastructure/database/sqlite-ticket-repo.js';
import { SqliteReminderRepository } from '../../src/infrastructure/database/sqlite-reminder-repo.js';
import { RecordMessageUseCase } from '../../src/application/use-cases/record-message.usecase.js';
import { ManageTicketsUseCase } from '../../src/application/use-cases/manage-tickets.usecase.js';
import { ManageRemindersUseCase } from '../../src/application/use-cases/manage-reminders.usecase.js';
import { TimerSchedulerService } from '../../src/infrastructure/scheduler/timer-scheduler.js';
import { MockAIProvider } from '../../src/infrastructure/ai/mock-ai-provider.js';
import { MessageOrchestrator } from '../../src/application/orchestrator.js';
import { GroupMessage } from '../../src/domain/models/message.js';

describe('Integration Tests: Message Orchestrator Pipeline', () => {
  let db: Database.Database;
  let messageRepo: SqliteMessageRepository;
  let ticketRepo: SqliteTicketRepository;
  let reminderRepo: SqliteReminderRepository;
  let scheduler: TimerSchedulerService;
  let aiProvider: MockAIProvider;
  let orchestrator: MessageOrchestrator;

  beforeEach(() => {
    db = createSqliteDatabase(':memory:');
    messageRepo = new SqliteMessageRepository(db);
    ticketRepo = new SqliteTicketRepository(db);
    reminderRepo = new SqliteReminderRepository(db);
    scheduler = new TimerSchedulerService();
    aiProvider = new MockAIProvider();

    const recordMessageUseCase = new RecordMessageUseCase(messageRepo);
    const manageTicketsUseCase = new ManageTicketsUseCase(ticketRepo);
    const manageRemindersUseCase = new ManageRemindersUseCase(reminderRepo, scheduler);

    orchestrator = new MessageOrchestrator({
      messageRepo,
      aiProvider,
      recordMessageUseCase,
      manageTicketsUseCase,
      manageRemindersUseCase,
      botTriggerKeyword: '@techsync bot',
      botName: 'TechSync Bot',
    });
  });

  it('should silently save normal messages without triggering a bot reply', async () => {
    const normalMsg: GroupMessage = {
      id: 'm-1',
      groupId: 'team-grp',
      senderId: 'ravi',
      senderName: 'Ravi',
      text: 'Client wants the demo moved',
      timestamp: Date.now(),
    };

    const response = await orchestrator.handleMessage(normalMsg);
    expect(response).toBeNull();
    expect(messageRepo.exists('m-1')).toBe(true);
  });

  it('should answer questions about decisions when tagged', async () => {
    // Populate chat history
    const history: GroupMessage[] = [
      {
        id: 'h-1',
        groupId: 'team-grp',
        senderId: 'ravi',
        senderName: 'Ravi',
        text: 'Vendor A is cheaper but B delivers in 2 days',
        timestamp: Date.now() - 3000,
      },
      {
        id: 'h-2',
        groupId: 'team-grp',
        senderId: 'priya',
        senderName: 'Priya',
        text: 'Go with B then, we cannot wait a week',
        timestamp: Date.now() - 2000,
      },
      {
        id: 'h-3',
        groupId: 'team-grp',
        senderId: 'ravi',
        senderName: 'Ravi',
        text: 'Done 👍 B it is',
        timestamp: Date.now() - 1000,
      },
    ];

    for (const msg of history) {
      await orchestrator.handleMessage(msg);
    }

    // Now user tags bot
    const tagMsg: GroupMessage = {
      id: 'h-4',
      groupId: 'team-grp',
      senderId: 'kiran',
      senderName: 'Kiran',
      text: '@TechSync Bot what did we decide about the vendor?',
      timestamp: Date.now(),
    };

    const response = await orchestrator.handleMessage(tagMsg);
    expect(response).not.toBeNull();
    expect(response?.replyText).toContain('Vendor B');
    expect(response?.replyText).toContain('Ravi');
  });

  it('should turn a quoted message into a ticket when requested', async () => {
    // 1. Meera sends a message
    const meeraMsg: GroupMessage = {
      id: 'msg-meera-101',
      groupId: 'team-grp',
      senderId: 'meera',
      senderName: 'Meera',
      text: 'Invoice for Acme still not sent',
      timestamp: Date.now() - 2000,
    };
    await orchestrator.handleMessage(meeraMsg);

    // 2. Someone replies quoting Meera's message:
    const ticketMsg: GroupMessage = {
      id: 'msg-kiran-102',
      groupId: 'team-grp',
      senderId: 'kiran',
      senderName: 'Kiran',
      text: '@TechSync Bot make that a ticket for Kiran, P1, due Friday',
      quotedMessageId: 'msg-meera-101',
      quotedText: 'Invoice for Acme still not sent',
      timestamp: Date.now(),
    };

    const response = await orchestrator.handleMessage(ticketMsg);
    expect(response).not.toBeNull();
    expect(response?.ticketCreated).toBeDefined();
    expect(response?.ticketCreated?.id).toBe('OPS-1');
    expect(response?.ticketCreated?.title).toBe('Invoice for Acme still not sent');
    expect(response?.ticketCreated?.assignee).toBe('Kiran');
    expect(response?.ticketCreated?.priority).toBe('P1');
    expect(response?.replyText).toContain('Opened *[OPS-1]*');
  });

  it('should close a ticket when instructed', async () => {
    // Create ticket first
    ticketRepo.save({
      id: 'OPS-14',
      groupId: 'team-grp',
      title: 'Send Acme invoice',
      assignee: 'Kiran',
      priority: 'P1',
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const closeMsg: GroupMessage = {
      id: 'msg-close-1',
      groupId: 'team-grp',
      senderId: 'kiran',
      senderName: 'Kiran',
      text: '@TechSync Bot close OPS-14',
      timestamp: Date.now(),
    };

    const response = await orchestrator.handleMessage(closeMsg);
    expect(response?.ticketClosed?.id).toBe('OPS-14');
    expect(response?.ticketClosed?.status).toBe('done');
    expect(response?.replyText).toContain('[OPS-14] closed');
  });

  it('should summarize the chat when requested', async () => {
    const summaryMsg: GroupMessage = {
      id: 'msg-summary-1',
      groupId: 'team-grp',
      senderId: 'kiran',
      senderName: 'Kiran',
      text: '@TechSync Bot catch up and summarize',
      timestamp: Date.now(),
    };

    const response = await orchestrator.handleMessage(summaryMsg);
    expect(response?.replyText).toContain('Group Catch-up Summary');
  });
});
