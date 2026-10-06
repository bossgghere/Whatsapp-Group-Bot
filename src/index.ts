import { config } from './config/env.js';
import { createSqliteDatabase } from './infrastructure/database/sqlite-client.js';
import { SqliteMessageRepository } from './infrastructure/database/sqlite-message-repo.js';
import { SqliteTicketRepository } from './infrastructure/database/sqlite-ticket-repo.js';
import { SqliteReminderRepository } from './infrastructure/database/sqlite-reminder-repo.js';
import { TimerSchedulerService } from './infrastructure/scheduler/timer-scheduler.js';
import { GeminiAIProvider } from './infrastructure/ai/gemini-provider.js';
import { BaileysWhatsAppGateway } from './infrastructure/whatsapp/baileys-client.js';
import { RecordMessageUseCase } from './application/use-cases/record-message.usecase.js';
import { ManageTicketsUseCase } from './application/use-cases/manage-tickets.usecase.js';
import { ManageRemindersUseCase } from './application/use-cases/manage-reminders.usecase.js';
import { MessageOrchestrator } from './application/orchestrator.js';
import { attachWhatsAppListener } from './presentation/whatsapp-listener.js';

async function bootstrap() {
  console.log('================================================================');
  console.log(`🚀 Starting ${config.botName}...`);
  console.log('================================================================');

  // 1. Initialize SQLite Database
  console.log(`[Storage] Initializing database at: ${config.databasePath}`);
  const db = createSqliteDatabase(config.databasePath);

  // 2. Initialize Repositories
  const messageRepo = new SqliteMessageRepository(db);
  const ticketRepo = new SqliteTicketRepository(db);
  const reminderRepo = new SqliteReminderRepository(db);

  // 3. Initialize Services
  const scheduler = new TimerSchedulerService();
  const aiProvider = new GeminiAIProvider(config.geminiApiKey);
  const whatsappGateway = new BaileysWhatsAppGateway(undefined, config.pairingPhoneNumber);

  // 4. Restore pending reminders from database
  scheduler.restorePendingReminders(
    () => reminderRepo.getPending(),
    async (reminder) => {
      reminderRepo.markCompleted(reminder.id);
      const tag = reminder.targetUser ? `@${reminder.targetUser} ` : '';
      const text = `⏰ *Reminder Alert!* ${tag}\n${reminder.prompt}`;
      console.log(`[Scheduler] Firing reminder ${reminder.id} for group ${reminder.groupId}`);
      await whatsappGateway.sendMessage(reminder.groupId, text);
    }
  );

  // 5. Initialize Use Cases
  const recordMessageUseCase = new RecordMessageUseCase(messageRepo);
  const manageTicketsUseCase = new ManageTicketsUseCase(ticketRepo);
  const manageRemindersUseCase = new ManageRemindersUseCase(reminderRepo, scheduler);

  // 6. Initialize Orchestrator
  const orchestrator = new MessageOrchestrator({
    messageRepo,
    aiProvider,
    recordMessageUseCase,
    manageTicketsUseCase,
    manageRemindersUseCase,
    whatsappGateway,
    botTriggerKeyword: config.botTriggerKeyword,
    botName: config.botName,
  });

  // 7. Attach Listener
  attachWhatsAppListener(whatsappGateway, orchestrator);

  // 8. Handle Graceful Shutdown
  const shutdown = async () => {
    console.log('\n[App] Shutting down gracefully...');
    try {
      await whatsappGateway.stop();
      db.close();
      console.log('[App] Cleanup complete. Exited.');
      process.exit(0);
    } catch (err) {
      console.error('[App] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // 9. Start WhatsApp Socket
  console.log('[App] Connecting to WhatsApp network...');
  await whatsappGateway.start();
}

bootstrap().catch((err) => {
  console.error('[App] Fatal error during startup:', err);
  process.exit(1);
});
