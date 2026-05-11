const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'training.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS training_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    grace_minutes INTEGER DEFAULT 10,
    pass_score INTEGER DEFAULT 60,
    location TEXT,
    status TEXT DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    status TEXT DEFAULT 'registered',
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES training_sessions(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(session_id, employee_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    checkin_time DATETIME NOT NULL,
    is_late INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (session_id) REFERENCES training_sessions(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(session_id, employee_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    score INTEGER,
    is_passed INTEGER DEFAULT 0,
    exam_time DATETIME,
    attempt INTEGER DEFAULT 1,
    FOREIGN KEY (session_id) REFERENCES training_sessions(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS retakes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    original_exam_id TEXT NOT NULL,
    scheduled_time DATETIME,
    status TEXT DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES training_sessions(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (original_exam_id) REFERENCES exams(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    exam_id TEXT NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    certificate_number TEXT,
    FOREIGN KEY (session_id) REFERENCES training_sessions(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    UNIQUE(session_id, employee_id)
  )`);
});

module.exports = db;
