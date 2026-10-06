import { GroupMessage } from '../models/message.js';

export interface IMessageRepository {
  save(message: GroupMessage): void;
  getRecentByGroup(groupId: string, limit?: number): GroupMessage[];
  getById(id: string): GroupMessage | null;
  exists(id: string): boolean;
}
