import { ITicketRepository } from '../../domain/repositories/ticket-repo.js';
import { Ticket, TicketPriority, TicketStatus } from '../../domain/models/ticket.js';

export interface CreateTicketParams {
  groupId: string;
  title: string;
  assignee: string;
  priority?: TicketPriority;
  dueDate?: string;
}

export class ManageTicketsUseCase {
  constructor(private ticketRepo: ITicketRepository) {}

  createTicket(params: CreateTicketParams): Ticket {
    const ticketId = this.ticketRepo.getNextTicketId(params.groupId);
    const now = Date.now();

    const ticket: Ticket = {
      id: ticketId,
      groupId: params.groupId,
      title: params.title.trim(),
      assignee: params.assignee.trim(),
      priority: params.priority || 'P2',
      dueDate: params.dueDate,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    this.ticketRepo.save(ticket);
    return ticket;
  }

  closeTicket(ticketId: string, closedByName?: string): { success: boolean; message: string; ticket?: Ticket } {
    const ticket = this.ticketRepo.getById(ticketId);
    if (!ticket) {
      return {
        success: false,
        message: `Ticket *${ticketId}* not found.`,
      };
    }

    const updated = this.ticketRepo.updateStatus(ticketId, 'done');
    const closer = closedByName || 'team';
    return {
      success: true,
      ticket: updated || ticket,
      message: `[${ticketId}] closed by *${closer}*. Nice one.`,
    };
  }

  listTickets(groupId: string, status: TicketStatus = 'open'): string {
    const tickets = this.ticketRepo.getByGroup(groupId, status);
    if (tickets.length === 0) {
      return `No ${status} tickets for this group right now! 🎉`;
    }

    const list = tickets
      .map((t) => {
        const due = t.dueDate ? ` • due ${t.dueDate}` : '';
        return `• *[${t.id}]* ${t.title} — @${t.assignee} [${t.priority}]${due}`;
      })
      .join('\n');

    return `*📋 Group ${status.toUpperCase()} Tickets (${tickets.length}):*\n${list}`;
  }

  formatTicketCreatedReply(ticket: Ticket): string {
    const dueInfo = ticket.dueDate ? ` • due ${ticket.dueDate}` : '';
    return `Opened *[${ticket.id}]* ${ticket.title} • *${ticket.assignee}* • [${ticket.priority}]${dueInfo}. I'll keep track of this here!`;
  }
}
