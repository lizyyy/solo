const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'library.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS readers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    identity_type TEXT NOT NULL CHECK(identity_type IN ('teacher', 'student', 'staff')),
    department TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS book_copies (
    id TEXT PRIMARY KEY,
    isbn TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved', 'borrowed', 'lost')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS booking_queue (
    id TEXT PRIMARY KEY,
    book_copy_id TEXT NOT NULL,
    reader_id TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'locked', 'fulfilled', 'cancelled', 'expired')),
    request_idempotency_key TEXT UNIQUE,
    window_start INTEGER,
    window_end INTEGER,
    position INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (book_copy_id) REFERENCES book_copies(id),
    FOREIGN KEY (reader_id) REFERENCES readers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS overdue_records (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    book_copy_id TEXT NOT NULL,
    reader_id TEXT NOT NULL,
    overdue_type TEXT NOT NULL CHECK(overdue_type IN ('pickup', 'return')),
    due_time INTEGER NOT NULL,
    actual_time INTEGER,
    released BOOLEAN DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES booking_queue(id),
    FOREIGN KEY (book_copy_id) REFERENCES book_copies(id),
    FOREIGN KEY (reader_id) REFERENCES readers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS circulation_reports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    content TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    generated_by TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    api_path TEXT NOT NULL,
    http_method TEXT NOT NULL,
    raw_input TEXT NOT NULL,
    error_message TEXT NOT NULL,
    processing_result TEXT NOT NULL,
    occurred_at INTEGER NOT NULL
  )`);
});

module.exports = db;
