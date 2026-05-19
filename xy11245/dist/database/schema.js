"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSchema = void 0;
const initSchema = (db) => {
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
exports.initSchema = initSchema;
