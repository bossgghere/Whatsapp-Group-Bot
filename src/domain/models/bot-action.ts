import { Ticket, TicketPriority } from './ticket.js';
import { Reminder } from './reminder.js';

export type IntentType =
  | 'qa'
  | 'summary'
  | 'create_ticket'
  | 'list_tickets'
  | 'close_ticket'
  | 'create_reminder'
  | 'analyze_media';

export interface TicketIntentData {
  title: string;
  assignee: string;
  priority: TicketPriority;
  dueDate?: string;
}

export interface ReminderIntentData {
  targetTimeMs: number;
  prompt: string;
  targetUser?: string;
}

export interface CloseTicketIntentData {
  ticketId: string;
}

export interface ParsedBotIntent {
  type: IntentType;
  confidence: number;
  explanation?: string;
  ticketData?: TicketIntentData;
  reminderData?: ReminderIntentData;
  closeTicketData?: CloseTicketIntentData;
  directAnswer?: string;
}

export interface BotResponse {
  replyText: string;
  ticketCreated?: Ticket;
  ticketClosed?: Ticket;
  reminderCreated?: Reminder;
}
