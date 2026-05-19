import Database from 'better-sqlite3';
import path from 'path';
import { initSchema, Book, ImportSession, ErrorRecord, BookStatus, ErrorType } from './schema';

const DB_PATH = path.join(process.cwd(), 'book-library.db');

let db: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (!db) {
    db = new Database(DB_PATH);
    initSchema(db);
  }
  return db;
};

export const closeDb = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};

export const bookRepo = {
  insert: (book: Omit<Book, 'id' | 'created_at' | 'updated_at'>): number => {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO books (session_id, isbn, title, condition, grade, donor, volunteer, scanned_at, status, notes)
      VALUES (@session_id, @isbn, @title, @condition, @grade, @donor, @volunteer, @scanned_at, @status, @notes)
    `);
    const result = stmt.run(book);
    return Number(result.lastInsertRowid);
  },

  updateStatus: (id: number, status: BookStatus, notes?: string): void => {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE books 
      SET status = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, notes, id);
  },

  findById: (id: number): Book | undefined => {
    const db = getDb();
    return db.prepare('SELECT * FROM books WHERE id = ?').get(id) as Book | undefined;
  },

  findAll: (filters?: {
    volunteer?: string;
    status?: BookStatus;
    startDate?: string;
    endDate?: string;
  }): Book[] => {
    const db = getDb();
    let query = 'SELECT * FROM books WHERE 1=1';
    const params: (string | number)[] = [];

    if (filters?.volunteer) {
      query += ' AND volunteer = ?';
      params.push(filters.volunteer);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC';
    return db.prepare(query).all(...params) as Book[];
  },

  existsByIsbn: (isbn: string): boolean => {
    const db = getDb();
    const result = db.prepare('SELECT 1 FROM books WHERE isbn = ? LIMIT 1').get(isbn);
    return !!result;
  }
};

export const sessionRepo = {
  insert: (session: Omit<ImportSession, 'id' | 'imported_at'>): number => {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO import_sessions (source_type, source_file, volunteer, total_records, success_count, error_count)
      VALUES (@source_type, @source_file, @volunteer, @total_records, @success_count, @error_count)
    `);
    const result = stmt.run(session);
    return Number(result.lastInsertRowid);
  },

  updateCounts: (id: number, successCount: number, errorCount: number): void => {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE import_sessions 
      SET success_count = ?, error_count = ?
      WHERE id = ?
    `);
    stmt.run(successCount, errorCount, id);
  },

  findAll: (): ImportSession[] => {
    const db = getDb();
    return db.prepare('SELECT * FROM import_sessions ORDER BY imported_at DESC').all() as ImportSession[];
  }
};

export const errorRepo = {
  insert: (error: Omit<ErrorRecord, 'id' | 'created_at' | 'resolved' | 'resolved_at'>): number => {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO error_records (session_id, source_file, row_number, raw_data, error_type, error_message, suggestion, volunteer)
      VALUES (@session_id, @source_file, @row_number, @raw_data, @error_type, @error_message, @suggestion, @volunteer)
    `);
    const result = stmt.run(error);
    return Number(result.lastInsertRowid);
  },

  markResolved: (id: number): void => {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE error_records 
      SET resolved = 1, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
  },

  findAll: (filters?: {
    type?: ErrorType;
    resolved?: boolean;
    volunteer?: string;
  }): ErrorRecord[] => {
    const db = getDb();
    let query = 'SELECT * FROM error_records WHERE 1=1';
    const params: (string | number | boolean)[] = [];

    if (filters?.type) {
      query += ' AND error_type = ?';
      params.push(filters.type);
    }
    if (filters?.resolved !== undefined) {
      query += ' AND resolved = ?';
      params.push(filters.resolved ? 1 : 0);
    }
    if (filters?.volunteer) {
      query += ' AND volunteer = ?';
      params.push(filters.volunteer);
    }

    query += ' ORDER BY created_at DESC';
    return db.prepare(query).all(...params) as ErrorRecord[];
  }
};

export { Book, ImportSession, ErrorRecord, BookStatus, ErrorType };
