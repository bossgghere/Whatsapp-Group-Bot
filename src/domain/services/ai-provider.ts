import { GroupMessage } from '../models/message.js';
import { ParsedBotIntent } from '../models/bot-action.js';

export interface IAIProvider {
  parseIntent(
    prompt: string,
    contextMessages: GroupMessage[],
    quotedMessage?: GroupMessage | null
  ): Promise<ParsedBotIntent>;

  answerQuery(
    question: string,
    contextMessages: GroupMessage[]
  ): Promise<string>;

  summarizeHistory(
    contextMessages: GroupMessage[]
  ): Promise<string>;

  analyzeMedia(
    mediaBuffer: Buffer,
    mimeType: string,
    prompt: string
  ): Promise<string>;
}
