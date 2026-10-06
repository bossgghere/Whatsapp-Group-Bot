import { IReminderRepository } from '../../domain/repositories/reminder-repo.js';
import { ISchedulerService } from '../../domain/services/scheduler.js';
import { Reminder } from '../../domain/models/reminder.js';

export interface CreateReminderParams {
  groupId: string;
  targetTimeMs: number;
  prompt: string;
  targetUser?: string;
  onFire?: (reminder: Reminder) => Promise<void>;
}

export class ManageRemindersUseCase {
  constructor(
    private reminderRepo: IReminderRepository,
    private schedulerService: ISchedulerService
  ) {}

  createReminder(params: CreateReminderParams): Reminder {
    const reminderId = `rem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const reminder: Reminder = {
      id: reminderId,
      groupId: params.groupId,
      targetTime: params.targetTimeMs,
      prompt: params.prompt,
      targetUser: params.targetUser,
      isCompleted: false,
      createdAt: Date.now(),
    };

    this.reminderRepo.save(reminder);

    this.schedulerService.schedule(reminder, async (fired) => {
      this.reminderRepo.markCompleted(fired.id);
      if (params.onFire) {
        await params.onFire(fired);
      }
    });

    return reminder;
  }

  formatConfirmation(reminder: Reminder): string {
    const targetDate = new Date(reminder.targetTime);
    const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tag = reminder.targetUser ? ` for @${reminder.targetUser}` : '';
    return `⏰ Reminder set${tag}: "${reminder.prompt}" at *${timeStr}*.`;
  }

  formatFiredMessage(reminder: Reminder): string {
    const tag = reminder.targetUser ? `@${reminder.targetUser} ` : '';
    return `⏰ *Reminder Alert!* ${tag}\n${reminder.prompt}`;
  }
}
