import fs from 'fs';
import path from 'path';
import { Ticket, Comment, StatusHistory, TicketStatus, TicketPriority } from '../types';

interface DatabaseData {
  tickets: Ticket[];
  comments: Comment[];
  statusHistory: StatusHistory[];
  nextTicketId: number;
  nextCommentId: number;
  nextHistoryId: number;
}

const DEFAULT_DATA: DatabaseData = {
  tickets: [],
  comments: [],
  statusHistory: [],
  nextTicketId: 1,
  nextCommentId: 1,
  nextHistoryId: 1,
};

export class JsonDatabase {
  private data: DatabaseData;
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.loadData();
  }

  private loadData(): DatabaseData {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading database:', error);
    }
    return { ...DEFAULT_DATA };
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveNow();
    }, 100);
  }

  private saveNow(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  getTickets(): Ticket[] {
    return [...this.data.tickets].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getTicketById(id: number): Ticket | undefined {
    return this.data.tickets.find(t => t.id === id);
  }

  createTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Ticket {
    const now = new Date().toISOString();
    const newTicket: Ticket = {
      id: this.data.nextTicketId++,
      status: TicketStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      ...ticket,
    };
    this.data.tickets.push(newTicket);
    this.scheduleSave();
    return newTicket;
  }

  updateTicket(id: number, updates: Partial<Ticket>): boolean {
    const index = this.data.tickets.findIndex(t => t.id === id);
    if (index === -1) return false;

    const now = new Date().toISOString();
    this.data.tickets[index] = {
      ...this.data.tickets[index],
      ...updates,
      updatedAt: now,
    };
    this.scheduleSave();
    return true;
  }

  deleteTicket(id: number): boolean {
    const index = this.data.tickets.findIndex(t => t.id === id);
    if (index === -1) return false;

    this.data.tickets.splice(index, 1);
    this.data.comments = this.data.comments.filter(c => c.ticketId !== id);
    this.data.statusHistory = this.data.statusHistory.filter(h => h.ticketId !== id);
    this.scheduleSave();
    return true;
  }

  getCommentsByTicketId(ticketId: number): Comment[] {
    return this.data.comments
      .filter(c => c.ticketId === ticketId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  createComment(comment: Omit<Comment, 'id' | 'createdAt'>): Comment {
    const now = new Date().toISOString();
    const newComment: Comment = {
      id: this.data.nextCommentId++,
      createdAt: now,
      ...comment,
    };
    this.data.comments.push(newComment);
    this.scheduleSave();
    return newComment;
  }

  getStatusHistoryByTicketId(ticketId: number): StatusHistory[] {
    return this.data.statusHistory
      .filter(h => h.ticketId === ticketId)
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  }

  createStatusHistory(history: Omit<StatusHistory, 'id' | 'changedAt'>): StatusHistory {
    const now = new Date().toISOString();
    const newHistory: StatusHistory = {
      id: this.data.nextHistoryId++,
      changedAt: now,
      ...history,
    };
    this.data.statusHistory.push(newHistory);
    this.scheduleSave();
    return newHistory;
  }

  getDistinctAssignees(): string[] {
    const assignees = new Set<string>();
    this.data.tickets.forEach(t => {
      if (t.assignee && t.assignee.trim()) {
        assignees.add(t.assignee);
      }
    });
    return Array.from(assignees).sort();
  }

  getDistinctTags(): string[] {
    const tags = new Set<string>();
    this.data.tickets.forEach(t => {
      if (t.tags) {
        t.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) tags.add(trimmed);
        });
      }
    });
    return Array.from(tags).sort();
  }
}

const dbPath = path.join(process.cwd(), 'data', 'tickets.json');
export const jsonDb = new JsonDatabase(dbPath);
