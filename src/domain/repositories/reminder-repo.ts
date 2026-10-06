import { Reminder } from '../models/reminder.js';

export interface IReminderRepository {
  save(reminder: Reminder): void;
  getById(id: string): Reminder | null;
  getPending(): Reminder[];
  getByGroup(groupId: string): Reminder[];
  markCompleted(id: string): void;
  delete(id: string): void;
}
