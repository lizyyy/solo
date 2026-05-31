import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'classroom.db');

let db = null;

export function initDatabase() {
  if (db) return db;
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS parts_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      modified_by TEXT,
      modified_at TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      UNIQUE(name, version)
    );

    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parts_list_id INTEGER NOT NULL,
      part_number TEXT NOT NULL,
      part_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      required BOOLEAN DEFAULT 1,
      FOREIGN KEY (parts_list_id) REFERENCES parts_lists(id)
    );

    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      teacher TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classroom_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id TEXT NOT NULL,
      run_number INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(classroom_id),
      UNIQUE(classroom_id, run_number)
    );

    CREATE TABLE IF NOT EXISTS student_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      step_number INTEGER,
      step_name TEXT,
      action TEXT NOT NULL,
      is_error BOOLEAN DEFAULT 0,
      error_message TEXT,
      video_path TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES classroom_runs(id)
    );

    CREATE TABLE IF NOT EXISTS change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assembly_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parts_list_id INTEGER NOT NULL,
      step_number INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      description TEXT,
      required_parts TEXT,
      video_required BOOLEAN DEFAULT 0,
      FOREIGN KEY (parts_list_id) REFERENCES parts_lists(id)
    );
  `);
  
  return db;
}

export function getDb() {
  if (!db) {
    return initDatabase();
  }
  return db;
}
