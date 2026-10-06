import { GroupMessage } from '../models/message.js';

export interface IWhatsAppGateway {
  sendMessage(toGroupId: string, text: string, quotedMessageId?: string): Promise<void>;
  onMessageReceived(handler: (message: GroupMessage) => Promise<void>): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
