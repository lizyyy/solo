import { jsonDb } from '../database/jsonDb';
import { Ticket, TicketStatus, TicketPriority, FilterParams, CreateTicketRequest, UpdateTicketRequest } from '../types';

export class TicketDao {
  create(ticket: CreateTicketRequest): Ticket {
    return jsonDb.createTicket({
      title: ticket.title,
      customerName: ticket.customerName,
      customerContact: ticket.customerContact,
      priority: ticket.priority || TicketPriority.MEDIUM,
      assignee: ticket.assignee || '',
      tags: ticket.tags || '',
      description: ticket.description,
    });
  }

  findById(id: number): Ticket | undefined {
    return jsonDb.getTicketById(id);
  }

  findAll(): Ticket[] {
    return jsonDb.getTickets();
  }

  findByFilters(filters: FilterParams): Ticket[] {
    let tickets = jsonDb.getTickets();

    if (filters.assignee) {
      tickets = tickets.filter(t => t.assignee === filters.assignee);
    }

    if (filters.status) {
      tickets = tickets.filter(t => t.status === filters.status);
    }

    if (filters.priority) {
      tickets = tickets.filter(t => t.priority === filters.priority);
    }

    if (filters.tags) {
      tickets = tickets.filter(t => t.tags.includes(filters.tags!));
    }

    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      tickets = tickets.filter(t => 
        t.title.toLowerCase().includes(keyword) ||
        t.description.toLowerCase().includes(keyword) ||
        t.customerName.toLowerCase().includes(keyword)
      );
    }

    return tickets;
  }

  update(id: number, updates: UpdateTicketRequest): boolean {
    const updateFields: Partial<Ticket> = {};

    if (updates.title !== undefined) updateFields.title = updates.title;
    if (updates.customerName !== undefined) updateFields.customerName = updates.customerName;
    if (updates.customerContact !== undefined) updateFields.customerContact = updates.customerContact;
    if (updates.priority !== undefined) updateFields.priority = updates.priority;
    if (updates.assignee !== undefined) updateFields.assignee = updates.assignee;
    if (updates.tags !== undefined) updateFields.tags = updates.tags;
    if (updates.description !== undefined) updateFields.description = updates.description;

    if (Object.keys(updateFields).length === 0) {
      return false;
    }

    return jsonDb.updateTicket(id, updateFields);
  }

  updateStatus(id: number, newStatus: TicketStatus): boolean {
    return jsonDb.updateTicket(id, { status: newStatus });
  }

  delete(id: number): boolean {
    return jsonDb.deleteTicket(id);
  }

  getDistinctAssignees(): string[] {
    return jsonDb.getDistinctAssignees();
  }

  getDistinctTags(): string[] {
    return jsonDb.getDistinctTags();
  }
}

export const ticketDao = new TicketDao();
