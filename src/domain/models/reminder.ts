export interface Reminder {
  id: string;
  groupId: string;
  targetTime: number; // Unix timestamp in ms
  prompt: string;
  targetUser?: string; // Tagged user e.g. "Kiran"
  isCompleted: boolean;
  createdAt: number;
}
