import { Reminder } from '../models/reminder.js';

export interface ISchedulerService {
  schedule(reminder: Reminder, callback: (reminder: Reminder) => Promise<void>): void;
  cancel(reminderId: string): void;
  restorePendingReminders(
    getPending: () => Reminder[],
    callback: (reminder: Reminder) => Promise<void>
  ): void;
}
