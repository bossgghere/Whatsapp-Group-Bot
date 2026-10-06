import { IMessageRepository } from '../domain/repositories/message-repo.js';
import { IAIProvider } from '../domain/services/ai-provider.js';
import { IWhatsAppGateway } from '../domain/services/whatsapp-gw.js';
import { GroupMessage } from '../domain/models/message.js';
import { BotResponse } from '../domain/models/bot-action.js';
import { RecordMessageUseCase } from './use-cases/record-message.usecase.js';
import { ManageTicketsUseCase } from './use-cases/manage-tickets.usecase.js';
import { ManageRemindersUseCase } from './use-cases/manage-reminders.usecase.js';

export interface OrchestratorDependencies {
  messageRepo: IMessageRepository;
  aiProvider: IAIProvider;
  recordMessageUseCase: RecordMessageUseCase;
  manageTicketsUseCase: ManageTicketsUseCase;
  manageRemindersUseCase: ManageRemindersUseCase;
  whatsappGateway?: IWhatsAppGateway;
  botTriggerKeyword?: string;
  botName?: string;
}

export class MessageOrchestrator {
  private messageRepo: IMessageRepository;
  private aiProvider: IAIProvider;
  private recordMessageUseCase: RecordMessageUseCase;
  private manageTicketsUseCase: ManageTicketsUseCase;
  private manageRemindersUseCase: ManageRemindersUseCase;
  private whatsappGateway?: IWhatsAppGateway;
  private botTriggerKeyword: string;
  private botName: string;

  constructor(deps: OrchestratorDependencies) {
    this.messageRepo = deps.messageRepo;
    this.aiProvider = deps.aiProvider;
    this.recordMessageUseCase = deps.recordMessageUseCase;
    this.manageTicketsUseCase = deps.manageTicketsUseCase;
    this.manageRemindersUseCase = deps.manageRemindersUseCase;
    this.whatsappGateway = deps.whatsappGateway;
    this.botTriggerKeyword = (deps.botTriggerKeyword || '@techsync bot').toLowerCase();
    this.botName = deps.botName || 'TechSync Bot';
  }

  async handleMessage(message: GroupMessage): Promise<BotResponse | null> {
    // 1. Ingest message silently into group history
    this.recordMessageUseCase.execute(message);

    // 2. Check if the message is directed at the bot
    const isTriggered = this.isBotMentioned(message);
    if (!isTriggered) {
      return null;
    }

    // 3. Clean user prompt
    const cleanedPrompt = this.cleanPrompt(message.text);

    // 4. Handle media directly if audio/document/image with buffer
    if (message.mediaBuffer && message.mediaMimeType) {
      const mediaAnswer = await this.aiProvider.analyzeMedia(
        message.mediaBuffer,
        message.mediaMimeType,
        cleanedPrompt
      );
      const response: BotResponse = { replyText: mediaAnswer };
      await this.maybeSendReply(message.groupId, response.replyText, message.id);
      return response;
    }

    // 5. Gather group context (last 30 messages)
    const context = this.messageRepo.getRecentByGroup(message.groupId, 30);

    // 6. Resolve quoted message if any
    let quoted: GroupMessage | null = null;
    if (message.quotedMessageId) {
      quoted = this.messageRepo.getById(message.quotedMessageId);
    }
    if (!quoted && message.quotedText) {
      quoted = {
        id: 'synthetic-quote',
        groupId: message.groupId,
        senderId: 'unknown',
        senderName: 'Quoted',
        text: message.quotedText,
        timestamp: message.timestamp - 1000,
      };
    }

    // 7. Parse intent via AI
    const intent = await this.aiProvider.parseIntent(cleanedPrompt, context, quoted);

    // 8. Execute intent action
    let response: BotResponse;

    switch (intent.type) {
      case 'create_ticket': {
        const ticketData = intent.ticketData || {
          title: quoted ? quoted.text : cleanedPrompt,
          assignee: 'Unassigned',
          priority: 'P2',
        };

        const ticket = this.manageTicketsUseCase.createTicket({
          groupId: message.groupId,
          title: ticketData.title || (quoted ? quoted.text : 'New Task'),
          assignee: ticketData.assignee || 'Unassigned',
          priority: ticketData.priority || 'P2',
          dueDate: ticketData.dueDate,
        });

        const replyText = this.manageTicketsUseCase.formatTicketCreatedReply(ticket);
        response = { replyText, ticketCreated: ticket };
        break;
      }

      case 'close_ticket': {
        const ticketId = intent.closeTicketData?.ticketId || 'OPS-1';
        const result = this.manageTicketsUseCase.closeTicket(ticketId, message.senderName);
        response = { replyText: result.message, ticketClosed: result.ticket };
        break;
      }

      case 'list_tickets': {
        const listText = this.manageTicketsUseCase.listTickets(message.groupId, 'open');
        response = { replyText: listText };
        break;
      }

      case 'create_reminder': {
        const remData = intent.reminderData || {
          targetTimeMs: Date.now() + 60 * 1000,
          prompt: cleanedPrompt,
        };

        const reminder = this.manageRemindersUseCase.createReminder({
          groupId: message.groupId,
          targetTimeMs: remData.targetTimeMs,
          prompt: remData.prompt,
          targetUser: remData.targetUser,
          onFire: async (firedRem) => {
            const fireMsg = this.manageRemindersUseCase.formatFiredMessage(firedRem);
            await this.maybeSendReply(firedRem.groupId, fireMsg);
          },
        });

        const replyText = this.manageRemindersUseCase.formatConfirmation(reminder);
        response = { replyText, reminderCreated: reminder };
        break;
      }

      case 'summary': {
        const summary = await this.aiProvider.summarizeHistory(context);
        response = { replyText: summary };
        break;
      }

      case 'qa':
      default: {
        let answer = intent.directAnswer;
        if (!answer || answer.length < 5) {
          answer = await this.aiProvider.answerQuery(cleanedPrompt, context);
        }
        response = { replyText: answer };
        break;
      }
    }

    // 9. Dispatch to WhatsApp gateway if connected
    await this.maybeSendReply(message.groupId, response.replyText, message.id);
    return response;
  }

  private isBotMentioned(message: GroupMessage): boolean {
    const textLower = message.text.toLowerCase().trim();
    if (textLower.includes(this.botTriggerKeyword)) return true;
    if (textLower.includes('@bot')) return true;
    if (textLower.includes('@7416723763')) return true;
    if (textLower.startsWith('!bot') || textLower.startsWith('/bot')) return true;
    if (textLower.startsWith('bot ') || textLower.startsWith('bot,') || textLower.startsWith('bot:')) return true;
    return false;
  }

  private cleanPrompt(text: string): string {
    return text
      .replace(new RegExp(this.botTriggerKeyword, 'gi'), '')
      .replace(/@bot/gi, '')
      .replace(/@7416723763/gi, '')
      .replace(/^!bot\s*/i, '')
      .replace(/^\/bot\s*/i, '')
      .replace(/^bot[:,]?\s*/i, '')
      .trim();
  }

  private async maybeSendReply(toGroupId: string, text: string, quotedMessageId?: string): Promise<void> {
    if (this.whatsappGateway) {
      try {
        await this.whatsappGateway.sendMessage(toGroupId, text, quotedMessageId);
      } catch (err) {
        console.error('[MessageOrchestrator] Failed to send WhatsApp reply:', err);
      }
    }
  }
}
