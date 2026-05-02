import { jsonDb } from '../database/jsonDb';
import { Comment, CreateCommentRequest } from '../types';

export class CommentDao {
  create(ticketId: number, comment: CreateCommentRequest): Comment {
    return jsonDb.createComment({
      ticketId,
      author: comment.author,
      content: comment.content,
    });
  }

  findById(id: number): Comment | undefined {
    const ticketId = this.getTicketIdFromCommentId(id);
    if (!ticketId) return undefined;
    const comments = jsonDb.getCommentsByTicketId(ticketId);
    return comments.find(c => c.id === id);
  }

  private getTicketIdFromCommentId(id: number): number | undefined {
    const tickets = jsonDb.getTickets();
    for (const ticket of tickets) {
      const comments = jsonDb.getCommentsByTicketId(ticket.id);
      if (comments.some(c => c.id === id)) {
        return ticket.id;
      }
    }
    return undefined;
  }

  findByTicketId(ticketId: number): Comment[] {
    return jsonDb.getCommentsByTicketId(ticketId);
  }

  delete(id: number): boolean {
    return false;
  }
}

export const commentDao = new CommentDao();
