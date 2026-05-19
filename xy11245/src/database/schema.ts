import Database from 'better-sqlite3';

export const initSchema = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_file TEXT NOT NULL,
      volunteer TEXT NOT NULL,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_records INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      isbn TEXT NOT NULL,
      title TEXT,
      condition TEXT,
      grade TEXT,
      donor TEXT,
      volunteer TEXT NOT NULL,
      scanned_at DATETIME,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES import_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS error_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      source_file TEXT,
      row_number INTEGER,
      raw_data TEXT,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      suggestion TEXT,
      volunteer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved BOOLEAN DEFAULT 0,
      resolved_at DATETIME,
      FOREIGN KEY (session_id) REFERENCES import_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
    CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
    CREATE INDEX IF NOT EXISTS idx_books_volunteer ON books(volunteer);
    CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at);
    CREATE INDEX IF NOT EXISTS idx_errors_type ON error_records(error_type);
    CREATE INDEX IF NOT EXISTS idx_errors_resolved ON error_records(resolved);
  `);
};

export type BookStatus = 'pending' | 'approved' | 'rejected' | 'shelved';

export type ErrorType = 
  | 'invalid_isbn'
  | 'missing_required'
  | 'invalid_condition'
  | 'invalid_grade'
  | 'duplicate_isbn'
  | 'parse_error'
  | 'unknown';

export interface Book {
  id?: number;
  session_id?: number;
  isbn: string;
  title?: string;
  condition?: string;
  grade?: string;
  donor?: string;
  volunteer: string;
  scanned_at?: string;
  status: BookStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ImportSession {
  id?: number;
  source_type: 'csv' | 'markdown';
  source_file: string;
  volunteer: string;
  imported_at?: string;
  total_records: number;
  success_count: number;
  error_count: number;
}

export interface ErrorRecord {
  id?: number;
  session_id?: number;
  source_file?: string;
  row_number?: number;
  raw_data?: string;
  error_type: ErrorType;
  error_message: string;
  suggestion?: string;
  volunteer?: string;
  created_at?: string;
  resolved?: boolean;
  resolved_at?: string;
}
