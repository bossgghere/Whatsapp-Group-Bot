import { IWhatsAppGateway } from '../../domain/services/whatsapp-gw.js';
import { GroupMessage } from '../../domain/models/message.js';

export interface SentMessageLog {
  toGroupId: string;
  text: string;
  quotedMessageId?: string;
  timestamp: number;
}

export class MockWhatsAppGateway implements IWhatsAppGateway {
  public sentMessages: SentMessageLog[] = [];
  private handler?: (message: GroupMessage) => Promise<void>;

  async sendMessage(toGroupId: string, text: string, quotedMessageId?: string): Promise<void> {
    this.sentMessages.push({
      toGroupId,
      text,
      quotedMessageId,
      timestamp: Date.now(),
    });
  }

  onMessageReceived(handler: (message: GroupMessage) => Promise<void>): void {
    this.handler = handler;
  }

  async simulateIncomingMessage(message: GroupMessage): Promise<void> {
    if (this.handler) {
      await this.handler(message);
    }
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}
