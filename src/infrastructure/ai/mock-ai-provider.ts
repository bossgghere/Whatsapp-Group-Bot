import { IAIProvider } from '../../domain/services/ai-provider.js';
import { GroupMessage } from '../../domain/models/message.js';
import { ParsedBotIntent } from '../../domain/models/bot-action.js';

export class MockAIProvider implements IAIProvider {
  public parseIntentMock?: (
    prompt: string,
    contextMessages: GroupMessage[],
    quotedMessage?: GroupMessage | null
  ) => Promise<ParsedBotIntent>;

  public answerQueryMock?: (
    question: string,
    contextMessages: GroupMessage[]
  ) => Promise<string>;

  public summarizeHistoryMock?: (
    contextMessages: GroupMessage[]
  ) => Promise<string>;

  public analyzeMediaMock?: (
    mediaBuffer: Buffer,
    mimeType: string,
    prompt: string
  ) => Promise<string>;

  async parseIntent(
    prompt: string,
    contextMessages: GroupMessage[],
    quotedMessage?: GroupMessage | null
  ): Promise<ParsedBotIntent> {
    if (this.parseIntentMock) {
      return this.parseIntentMock(prompt, contextMessages, quotedMessage);
    }

    const lower = prompt.toLowerCase();
    if (lower.includes('make that a ticket') || lower.includes('create ticket')) {
      return {
        type: 'create_ticket',
        confidence: 0.95,
        ticketData: {
          title: quotedMessage ? quotedMessage.text : 'Important Task',
          assignee: 'Kiran',
          priority: 'P1',
          dueDate: 'Fri 3 Oct',
        },
      };
    }

    if (lower.includes('close ops-14') || lower.includes('ops-14 closed')) {
      return {
        type: 'close_ticket',
        confidence: 0.95,
        closeTicketData: { ticketId: 'OPS-14' },
      };
    }

    if (lower.includes('list tickets') || lower.includes('open tickets')) {
      return {
        type: 'list_tickets',
        confidence: 0.95,
      };
    }

    if (lower.includes('remind')) {
      return {
        type: 'create_reminder',
        confidence: 0.95,
        reminderData: {
          targetTimeMs: Date.now() + 5000,
          prompt: 'Send Acme invoice',
          targetUser: 'Kiran',
        },
      };
    }

    if (lower.includes('summarize') || lower.includes('catch up')) {
      return {
        type: 'summary',
        confidence: 0.95,
      };
    }

    return {
      type: 'qa',
      confidence: 0.9,
      directAnswer: 'You chose *Vendor B* on Tuesday. Ravi decided because B delivers in 2 days. Priya agreed at 11:04.',
    };
  }

  async answerQuery(question: string, contextMessages: GroupMessage[]): Promise<string> {
    if (this.answerQueryMock) {
      return this.answerQueryMock(question, contextMessages);
    }
    return `You chose *Vendor B* on Tuesday. Ravi decided because B delivers in 2 days. Priya agreed at 11:04.`;
  }

  async summarizeHistory(contextMessages: GroupMessage[]): Promise<string> {
    if (this.summarizeHistoryMock) {
      return this.summarizeHistoryMock(contextMessages);
    }
    return `*Group Catch-up Summary:*\n- *Decision:* Vendor B selected for faster 2-day delivery.\n- *Ticket:* Acme invoice assigned to Kiran.`;
  }

  async analyzeMedia(mediaBuffer: Buffer, mimeType: string, prompt: string): Promise<string> {
    if (this.analyzeMediaMock) {
      return this.analyzeMediaMock(mediaBuffer, mimeType, prompt);
    }
    return `Audio transcript: "Can the demo move to Monday?" (Language: Telugu / English)`;
  }
}
