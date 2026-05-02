import { jsonDb } from '../database/jsonDb';
import { StatusHistory, TicketStatus } from '../types';

export class StatusHistoryDao {
  create(
    ticketId: number,
    oldStatus: TicketStatus | null,
    newStatus: TicketStatus,
    changedBy: string,
    remark: string = ''
  ): StatusHistory {
    return jsonDb.createStatusHistory({
      ticketId,
      oldStatus,
      newStatus,
      changedBy,
      remark,
    });
  }

  findById(id: number): StatusHistory | undefined {
    const ticketId = this.getTicketIdFromHistoryId(id);
    if (!ticketId) return undefined;
    const history = jsonDb.getStatusHistoryByTicketId(ticketId);
    return history.find(h => h.id === id);
  }

  private getTicketIdFromHistoryId(id: number): number | undefined {
    const tickets = jsonDb.getTickets();
    for (const ticket of tickets) {
      const history = jsonDb.getStatusHistoryByTicketId(ticket.id);
      if (history.some(h => h.id === id)) {
        return ticket.id;
      }
    }
    return undefined;
  }

  findByTicketId(ticketId: number): StatusHistory[] {
    return jsonDb.getStatusHistoryByTicketId(ticketId);
  }
}

export const statusHistoryDao = new StatusHistoryDao();
