import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  geminiApiKey: string;
  botName: string;
  botTriggerKeyword: string;
  databasePath: string;
  logLevel: string;
  pairingPhoneNumber?: string;
}

export const config: AppConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  botName: process.env.BOT_NAME || 'TechSync Bot',
  botTriggerKeyword: (process.env.BOT_TRIGGER_KEYWORD || '@TechSync Bot').toLowerCase(),
  databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'bot.sqlite'),
  logLevel: process.env.LOG_LEVEL || 'info',
  pairingPhoneNumber: process.env.PAIRING_PHONE_NUMBER || undefined,
};
