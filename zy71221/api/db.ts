import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const dataDir = path.join(projectRoot, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'stocklending.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    security_code TEXT NOT NULL UNIQUE,
    security_name TEXT NOT NULL,
    total_qty INTEGER NOT NULL CHECK(total_qty >= 0),
    locked_qty INTEGER NOT NULL DEFAULT 0 CHECK(locked_qty >= 0 AND locked_qty <= total_qty)
  );

  CREATE TABLE IF NOT EXISTS reservation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_account TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_priority INTEGER NOT NULL DEFAULT 5,
    security_code TEXT NOT NULL,
    security_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','locked','returned','overdue','cancelled','compensation_error')),
    reserve_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    return_date TEXT,
    cancel_date TEXT,
    cancel_reason TEXT,
    compensation_status TEXT CHECK(compensation_status IS NULL OR compensation_status IN ('success','failed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (security_code) REFERENCES inventory(security_code)
  );
`)

db.exec(`
  INSERT OR IGNORE INTO inventory (security_code, security_name, total_qty, locked_qty) VALUES
    ('600519', '贵州茅台', 5000, 3000),
    ('000858', '五粮液', 8000, 3000),
    ('601318', '中国平安', 12000, 5000),
    ('000001', '平安银行', 15000, 0),
    ('600036', '招商银行', 10000, 6000);
`)

const count = (db.prepare('SELECT COUNT(*) as cnt FROM reservation').get() as { cnt: number }).cnt
if (count === 0) {
  db.exec(`
    INSERT INTO reservation (client_account, client_name, client_priority, security_code, security_name, quantity, status, reserve_date, due_date) VALUES
      ('ACC001', '星辰资本', 1, '600519', '贵州茅台', 1000, 'locked', '2026-05-20', '2026-06-20'),
      ('ACC002', '远航投资', 2, '600519', '贵州茅台', 2000, 'locked', '2026-05-18', '2026-05-25'),
      ('ACC003', '朝阳基金', 3, '000858', '五粮液', 3000, 'locked', '2026-05-15', '2026-06-15'),
      ('ACC004', '蓝海资管', 2, '601318', '中国平安', 5000, 'locked', '2026-05-10', '2026-06-10'),
      ('ACC006', '盛和投资', 3, '600036', '招商银行', 6000, 'locked', '2026-05-01', '2026-05-27');

    INSERT INTO reservation (client_account, client_name, client_priority, security_code, security_name, quantity, status, reserve_date, due_date, return_date) VALUES
      ('ACC001', '星辰资本', 1, '601318', '中国平安', 2000, 'returned', '2026-04-01', '2026-05-01', '2026-04-28');

    INSERT INTO reservation (client_account, client_name, client_priority, security_code, security_name, quantity, status, reserve_date, due_date, cancel_date, cancel_reason, compensation_status) VALUES
      ('ACC005', '鼎信证券', 4, '000001', '平安银行', 4000, 'cancelled', '2026-05-05', '2026-06-05', '2026-05-22', '客户主动撤单', 'success');
  `)
}

export default db
