import { ISchedulerService } from '../../domain/services/scheduler.js';
import { Reminder } from '../../domain/models/reminder.js';

export class TimerSchedulerService implements ISchedulerService {
  private activeTimers = new Map<string, NodeJS.Timeout>();

  schedule(reminder: Reminder, callback: (reminder: Reminder) => Promise<void>): void {
    // If timer already active, cancel existing
    this.cancel(reminder.id);

    const now = Date.now();
    const delay = Math.max(0, reminder.targetTime - now);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(reminder.id);
      try {
        await callback(reminder);
      } catch (err) {
        console.error(`[TimerScheduler] Error executing reminder ${reminder.id}:`, err);
      }
    }, delay);

    this.activeTimers.set(reminder.id, timer);
  }

  cancel(reminderId: string): void {
    const existing = this.activeTimers.get(reminderId);
    if (existing) {
      clearTimeout(existing);
      this.activeTimers.delete(reminderId);
    }
  }

  restorePendingReminders(
    getPending: () => Reminder[],
    callback: (reminder: Reminder) => Promise<void>
  ): void {
    const pendingList = getPending();
    for (const reminder of pendingList) {
      this.schedule(reminder, callback);
    }
    if (pendingList.length > 0) {
      console.log(`[TimerScheduler] Restored ${pendingList.length} pending reminders from database.`);
    }
  }

  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }
}
