import { describe, it, expect } from 'vitest';
import { GeminiAIProvider } from '../../src/infrastructure/ai/gemini-provider.js';
import { MockAIProvider } from '../../src/infrastructure/ai/mock-ai-provider.js';
import { GroupMessage } from '../../src/domain/models/message.js';

describe('Phase 2: AI Provider Unit Tests', () => {
  const dummyContext: GroupMessage[] = [
    {
      id: 'm1',
      groupId: 'group-1',
      senderId: 'ravi',
      senderName: 'Ravi',
      text: 'Vendor A is cheaper but B delivers in 2 days',
      timestamp: Date.now() - 5000,
    },
    {
      id: 'm2',
      groupId: 'group-1',
      senderId: 'priya',
      senderName: 'Priya',
      text: 'Go with B then, we cannot wait a week',
      timestamp: Date.now() - 4000,
    },
    {
      id: 'm3',
      groupId: 'group-1',
      senderId: 'ravi',
      senderName: 'Ravi',
      text: 'Done, B it is',
      timestamp: Date.now() - 3000,
    },
  ];

  describe('Fallback Regex Parser (Offline / Zero-Key mode)', () => {
    const offlineProvider = new GeminiAIProvider('');

    it('should parse ticket creation from prompt and quoted message', async () => {
      const quoted: GroupMessage = {
        id: 'quote-1',
        groupId: 'group-1',
        senderId: 'meera',
        senderName: 'Meera',
        text: 'Invoice for Acme still not sent',
        timestamp: Date.now() - 2000,
      };

      const intent = await offlineProvider.parseIntent(
        'make that a ticket for Kiran, P1, due Friday',
        dummyContext,
        quoted
      );

      expect(intent.type).toBe('create_ticket');
      expect(intent.ticketData).toBeDefined();
      expect(intent.ticketData?.assignee).toBe('Kiran');
      expect(intent.ticketData?.priority).toBe('P1');
      expect(intent.ticketData?.dueDate).toBe('Friday');
      expect(intent.ticketData?.title).toBe('Invoice for Acme still not sent');
    });

    it('should parse ticket closure command', async () => {
      const intent = await offlineProvider.parseIntent(
        'close OPS-14',
        dummyContext
      );

      expect(intent.type).toBe('close_ticket');
      expect(intent.closeTicketData?.ticketId).toBe('OPS-14');
    });

    it('should parse chat summary command', async () => {
      const intent = await offlineProvider.parseIntent(
        'summarize today',
        dummyContext
      );

      expect(intent.type).toBe('summary');
    });

    it('should parse reminder command', async () => {
      const intent = await offlineProvider.parseIntent(
        'remind @Kiran to send invoice',
        dummyContext
      );

      expect(intent.type).toBe('create_reminder');
      expect(intent.reminderData?.targetUser).toBe('Kiran');
    });
  });

  describe('MockAIProvider', () => {
    const mockAI = new MockAIProvider();

    it('should return contextual answer on Q&A', async () => {
      const answer = await mockAI.answerQuery('What did we decide about the vendor?', dummyContext);
      expect(answer).toContain('Vendor B');
      expect(answer).toContain('Ravi');
    });

    it('should return structured chat summary', async () => {
      const summary = await mockAI.summarizeHistory(dummyContext);
      expect(summary).toContain('Group Catch-up Summary');
      expect(summary).toContain('Vendor B');
    });
  });
});
