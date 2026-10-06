import readline from 'readline';
import { createSqliteDatabase } from '../infrastructure/database/sqlite-client.js';
import { SqliteMessageRepository } from '../infrastructure/database/sqlite-message-repo.js';
import { SqliteTicketRepository } from '../infrastructure/database/sqlite-ticket-repo.js';
import { SqliteReminderRepository } from '../infrastructure/database/sqlite-reminder-repo.js';
import { RecordMessageUseCase } from '../application/use-cases/record-message.usecase.js';
import { ManageTicketsUseCase } from '../application/use-cases/manage-tickets.usecase.js';
import { ManageRemindersUseCase } from '../application/use-cases/manage-reminders.usecase.js';
import { TimerSchedulerService } from '../infrastructure/scheduler/timer-scheduler.js';
import { GeminiAIProvider } from '../infrastructure/ai/gemini-provider.js';
import { MessageOrchestrator } from '../application/orchestrator.js';
import { config } from '../config/env.js';
import { GroupMessage } from '../domain/models/message.js';

async function runSimulator() {
  console.clear();
  console.log('================================================================');
  console.log('💬 WhatsApp Group AI Bot — Interactive CLI Simulator');
  console.log('================================================================');
  console.log('Simulating WhatsApp Group: "Product Team"');
  console.log(`Bot trigger: "${config.botTriggerKeyword}" or "@bot"`);
  console.log('Commands:');
  console.log('  • Type any message as the current user');
  console.log('  • Type "/switch <name>" to change current sender (e.g., /switch Priya)');
  console.log('  • Type "/quote <text>" to reply quoting a previous message');
  console.log('  • Type "exit" to quit');
  console.log('----------------------------------------------------------------\n');

  // Initialize in-memory or file database for simulator
  const db = createSqliteDatabase(':memory:');
  const messageRepo = new SqliteMessageRepository(db);
  const ticketRepo = new SqliteTicketRepository(db);
  const reminderRepo = new SqliteReminderRepository(db);
  const scheduler = new TimerSchedulerService();

  const aiProvider = new GeminiAIProvider(config.geminiApiKey);

  const recordMessageUseCase = new RecordMessageUseCase(messageRepo);
  const manageTicketsUseCase = new ManageTicketsUseCase(ticketRepo);
  const manageRemindersUseCase = new ManageRemindersUseCase(reminderRepo, scheduler);

  const orchestrator = new MessageOrchestrator({
    messageRepo,
    aiProvider,
    recordMessageUseCase,
    manageTicketsUseCase,
    manageRemindersUseCase,
    botTriggerKeyword: config.botTriggerKeyword,
    botName: config.botName,
  });

  let currentUser = 'Ravi';
  let lastMessageId = '';
  let lastMessageText = '';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question(`[${currentUser}]: `, async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === 'exit') {
        console.log('\n👋 Exiting simulator. Goodbye!');
        rl.close();
        process.exit(0);
      }

      if (trimmed.startsWith('/switch ')) {
        const newUser = trimmed.replace('/switch ', '').trim();
        if (newUser) currentUser = newUser;
        console.log(`Switched active sender to: ${currentUser}\n`);
        promptUser();
        return;
      }

      let text = trimmed;
      let quotedId: string | undefined = undefined;
      let quotedText: string | undefined = undefined;

      if (trimmed.startsWith('/quote ')) {
        text = trimmed.replace('/quote ', '').trim();
        quotedId = lastMessageId;
        quotedText = lastMessageText;
        console.log(`  ↪ Quoting: "${quotedText}"`);
      }

      const msgId = `msg-${Date.now()}`;
      lastMessageId = msgId;
      lastMessageText = text;

      const groupMsg: GroupMessage = {
        id: msgId,
        groupId: 'simulated-group-1',
        senderId: currentUser.toLowerCase(),
        senderName: currentUser,
        text,
        quotedMessageId: quotedId,
        quotedText: quotedText,
        timestamp: Date.now(),
      };

      try {
        const response = await orchestrator.handleMessage(groupMsg);

        if (response) {
          console.log('\n🤖 \x1b[32m[TechSync Bot]:\x1b[0m');
          console.log(`\x1b[32m${response.replyText}\x1b[0m\n`);
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }

      promptUser();
    });
  };

  promptUser();
}

runSimulator();
