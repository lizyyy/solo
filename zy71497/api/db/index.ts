import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/piano_ledger.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enroll_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT DEFAULT '',
      total_stars INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      parent_note TEXT DEFAULT '',
      is_abnormal INTEGER NOT NULL DEFAULT 0,
      confirmed INTEGER NOT NULL DEFAULT 0,
      stars_earned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (student_id) REFERENCES students(id),
      UNIQUE(student_id, date)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      reason TEXT DEFAULT '',
      stars_deducted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS makeups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      makeup_date TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      stars_returned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (leave_id) REFERENCES leaves(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      UNIQUE(leave_id)
    );

    CREATE TABLE IF NOT EXISTS star_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      reference_type TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS reward_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_key TEXT NOT NULL UNIQUE,
      rule_value REAL NOT NULL,
      description TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    INSERT OR IGNORE INTO reward_rules (rule_key, rule_value, description) VALUES
      ('stars_per_minute', 1, '每练琴1分钟获得星星数'),
      ('leave_deduction', 5, '请假一次扣除星星数'),
      ('makeup_return_rate', 1, '补练返还倍率（补练时长 × 此倍率 × 每分钟星数）'),
      ('abnormal_threshold', 120, '时长异常阈值（分钟），超过此值标黄警告');

    CREATE INDEX IF NOT EXISTS idx_checkins_student_date ON checkins(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_leaves_student_date ON leaves(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_makeups_leave_id ON makeups(leave_id);
    CREATE INDEX IF NOT EXISTS idx_star_transactions_student ON star_transactions(student_id);
    CREATE INDEX IF NOT EXISTS idx_star_transactions_type ON star_transactions(type);
  `);
};

initDb();

export default db;
