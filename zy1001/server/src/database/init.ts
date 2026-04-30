import db from './connection';
import { TicketStatus, TicketPriority } from '../types';

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerContact TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT '${TicketPriority.MEDIUM}',
      status TEXT NOT NULL DEFAULT '${TicketStatus.PENDING}',
      assignee TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticketId INTEGER NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticketId INTEGER NOT NULL,
      oldStatus TEXT,
      newStatus TEXT NOT NULL,
      changedBy TEXT NOT NULL,
      changedAt TEXT NOT NULL,
      remark TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee);
    CREATE INDEX IF NOT EXISTS idx_comments_ticketId ON comments(ticketId);
    CREATE INDEX IF NOT EXISTS idx_status_history_ticketId ON status_history(ticketId);
  `);

  console.log('Database initialized successfully');
}

export default initDatabase;
