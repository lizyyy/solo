const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.TEST_DB || path.join(__dirname, '../../data/chess.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  current_level TEXT NOT NULL,
  join_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  evaluation_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  opponent TEXT NOT NULL,
  opponent_level TEXT NOT NULL,
  result TEXT NOT NULL,
  game_date TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  win_rate REAL NOT NULL,
  attendance_score REAL NOT NULL,
  teacher_tags TEXT NOT NULL,
  overall_score REAL NOT NULL,
  recommendation TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  evaluation_id INTEGER NOT NULL,
  decision TEXT NOT NULL,
  comment TEXT,
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
);
`);

module.exports = db;
