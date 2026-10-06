import { Ticket, TicketStatus } from '../models/ticket.js';

export interface ITicketRepository {
  save(ticket: Ticket): void;
  getById(id: string): Ticket | null;
  getByGroup(groupId: string, status?: TicketStatus): Ticket[];
  updateStatus(id: string, status: TicketStatus): Ticket | null;
  getNextTicketId(groupId: string): string;
}
