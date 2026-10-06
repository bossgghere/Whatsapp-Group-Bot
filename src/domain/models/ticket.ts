export type TicketStatus = 'open' | 'in_progress' | 'done' | 'closed';
export type TicketPriority = 'P1' | 'P2' | 'P3';

export interface Ticket {
  id: string; // e.g., "OPS-14"
  groupId: string;
  title: string;
  assignee: string; // Name or tag e.g. "Kiran"
  priority: TicketPriority;
  dueDate?: string; // e.g. "Fri 3 Oct" or "2026-10-10"
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
}
