"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_DIR = path_1.default.resolve(process.cwd(), 'data');
const DB_PATH = path_1.default.join(DB_DIR, 'sample-review.db');
if (!fs_1.default.existsSync(DB_DIR)) {
    fs_1.default.mkdirSync(DB_DIR, { recursive: true });
}
const db = new better_sqlite3_1.default(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
const initDatabase = () => {
    db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      sample_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      supplier TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'CREATED',
      version INTEGER NOT NULL DEFAULT 1,
      is_frozen INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      frozen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS review_tasks (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      sample_no TEXT NOT NULL,
      assignee TEXT NOT NULL,
      task_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      due_date TEXT,
      opinion TEXT,
      rating INTEGER,
      completed_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trial_feedbacks (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      sample_no TEXT NOT NULL,
      trial_user TEXT NOT NULL,
      trial_date TEXT NOT NULL,
      trial_period INTEGER NOT NULL,
      trial_location TEXT NOT NULL,
      test_items TEXT NOT NULL,
      overall_rating INTEGER NOT NULL,
      conclusion TEXT NOT NULL,
      suggestions TEXT,
      attachments TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS finalization_records (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      sample_no TEXT NOT NULL,
      final_version INTEGER NOT NULL,
      approved_by TEXT NOT NULL,
      approved_at TEXT NOT NULL,
      final_quantity INTEGER NOT NULL,
      final_unit_price REAL NOT NULL,
      final_total_amount REAL NOT NULL,
      remarks TEXT,
      attachments TEXT,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS return_records (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      sample_no TEXT NOT NULL,
      return_type TEXT NOT NULL,
      return_reason TEXT NOT NULL,
      return_quantity INTEGER NOT NULL,
      returned_by TEXT NOT NULL,
      returned_at TEXT NOT NULL,
      tracking_no TEXT,
      received_by TEXT,
      received_at TEXT,
      remarks TEXT,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS history_records (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT,
      operator TEXT NOT NULL,
      operation_time TEXT NOT NULL,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS background_tasks (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      payload TEXT NOT NULL,
      result TEXT,
      error_message TEXT,
      error_stack TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      next_retry_at TEXT
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      request_path TEXT NOT NULL,
      request_body TEXT,
      response TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
    CREATE INDEX IF NOT EXISTS idx_samples_sample_no ON samples(sample_no);
    CREATE INDEX IF NOT EXISTS idx_review_tasks_sample_id ON review_tasks(sample_id);
    CREATE INDEX IF NOT EXISTS idx_review_tasks_assignee ON review_tasks(assignee);
    CREATE INDEX IF NOT EXISTS idx_review_tasks_status ON review_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_trial_feedbacks_sample_id ON trial_feedbacks(sample_id);
    CREATE INDEX IF NOT EXISTS idx_history_entity ON history_records(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_history_time ON history_records(operation_time);
    CREATE INDEX IF NOT EXISTS idx_bg_tasks_status ON background_tasks(status);
  `);
    console.log('Database initialized successfully');
};
exports.initDatabase = initDatabase;
exports.default = db;
