import { IMessageRepository } from '../../domain/repositories/message-repo.js';
import { GroupMessage } from '../../domain/models/message.js';

export class RecordMessageUseCase {
  constructor(private messageRepo: IMessageRepository) {}

  execute(message: GroupMessage): boolean {
    if (this.messageRepo.exists(message.id)) {
      return false; // Already recorded (deduplication)
    }
    this.messageRepo.save(message);
    return true;
  }
}
