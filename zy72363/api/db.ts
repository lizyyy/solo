import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const db = new Database(path.join(__dirname, 'data.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS batch (id TEXT PRIMARY KEY,filename TEXT NOT NULL,total_in_file INTEGER NOT NULL DEFAULT 0,imported_count INTEGER NOT NULL DEFAULT 0,duplicate_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS sensor_data (id TEXT PRIMARY KEY,sensor_code TEXT NOT NULL UNIQUE,batch_id TEXT NOT NULL,material_type TEXT NOT NULL DEFAULT '',rpm_min REAL NOT NULL DEFAULT 0,rpm_max REAL NOT NULL DEFAULT 0,coefficient REAL NOT NULL DEFAULT 1.0,coefficient_manual INTEGER NOT NULL DEFAULT 0,coefficient_reason TEXT,remark TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY (batch_id) REFERENCES batch(id));
  CREATE TABLE IF NOT EXISTS photo_meta (id TEXT PRIMARY KEY,sensor_id TEXT NOT NULL,filename TEXT NOT NULL,url TEXT NOT NULL,remark TEXT NOT NULL DEFAULT '',uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY (sensor_id) REFERENCES sensor_data(id));
  CREATE TABLE IF NOT EXISTS safety_zone (id TEXT PRIMARY KEY,sensor_id TEXT NOT NULL UNIQUE,rpm_min REAL NOT NULL DEFAULT 0,rpm_max REAL NOT NULL DEFAULT 0,coefficient REAL NOT NULL DEFAULT 1.0,coefficient_source TEXT NOT NULL DEFAULT 'auto',coefficient_reason TEXT,review_status TEXT NOT NULL DEFAULT 'pending',reviewer TEXT,review_comment TEXT,reviewed_at TEXT,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY (sensor_id) REFERENCES sensor_data(id));
  CREATE TABLE IF NOT EXISTS change_record (id TEXT PRIMARY KEY,target_type TEXT NOT NULL,target_id TEXT NOT NULL,field TEXT NOT NULL,old_value TEXT NOT NULL,new_value TEXT NOT NULL,operator TEXT NOT NULL DEFAULT 'system',reason TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
`)

const countRow = db.prepare('SELECT COUNT(*) as cnt FROM batch').get() as { cnt: number }
if (countRow.cnt === 0) {
  console.log('[DB] 空数据库，跳过种子数据（等待用户导入样例 CSV）')
}

export default db
