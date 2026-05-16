const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'health.db');
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
 fs.mkdirSync(dataDir, { recursive: true });
}
const db = new sqlite3.Database(dbPath, (err) => {
 if (err) {
 console.error('数据库连接失败:', err.message);
 }
 else {
 console.log('已连接到SQLite数据库');
 initTables();
 }
});
function initTables() {
 db.serialize(() => {
 db.run(`CREATE TABLE IF NOT EXISTS vendors (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL UNIQUE,
 description TEXT,
 contact_info TEXT,
 status TEXT DEFAULT 'active',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
 )`);
 db.run(`CREATE TABLE IF NOT EXISTS interfaces (
 id TEXT PRIMARY KEY,
 vendor_id TEXT NOT NULL,
 name TEXT NOT NULL,
 endpoint TEXT,
 method TEXT,
 timeout_threshold INTEGER DEFAULT 5000,
 failure_threshold REAL DEFAULT 0.1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(vendor_id, name),
 FOREIGN KEY (vendor_id) REFERENCES vendors(id)
 )`);
 db.run(`CREATE TABLE IF NOT EXISTS failure_records (
 id TEXT PRIMARY KEY,
 interface_id TEXT NOT NULL,
 vendor_id TEXT NOT NULL,
 error_type TEXT NOT NULL,
 error_message TEXT,
 raw_input TEXT,
 processing_evidence TEXT,
 final_conclusion TEXT,
 request_time INTEGER NOT NULL,
 duration INTEGER,
 is_sample INTEGER DEFAULT 0,
 created_at INTEGER NOT NULL,
 FOREIGN KEY (interface_id) REFERENCES interfaces(id),
 FOREIGN KEY (vendor_id) REFERENCES vendors(id)
 )`);
 db.run(`CREATE TABLE IF NOT EXISTS health_scores (
 id TEXT PRIMARY KEY,
 interface_id TEXT NOT NULL,
 vendor_id TEXT NOT NULL,
 score REAL NOT NULL,
 failure_rate REAL NOT NULL,
 total_requests INTEGER NOT NULL,
 failure_count INTEGER NOT NULL,
 timeout_count INTEGER NOT NULL,
 period_start INTEGER NOT NULL,
 period_end INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY (interface_id) REFERENCES interfaces(id),
 FOREIGN KEY (vendor_id) REFERENCES vendors(id)
 )`);
 db.run(`CREATE TABLE IF NOT EXISTS disposal_actions (
 id TEXT PRIMARY KEY,
 interface_id TEXT NOT NULL,
 vendor_id TEXT NOT NULL,
 health_score_id TEXT,
 action_type TEXT NOT NULL,
 action_reason TEXT NOT NULL,
 status TEXT NOT NULL,
 triggered_by TEXT DEFAULT 'system',
 action_result TEXT,
 raw_input TEXT,
 processing_evidence TEXT,
 final_conclusion TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 FOREIGN KEY (interface_id) REFERENCES interfaces(id),
 FOREIGN KEY (vendor_id) REFERENCES vendors(id),
 FOREIGN KEY (health_score_id) REFERENCES health_scores(id)
 )`);
 db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
 id TEXT PRIMARY KEY,
 interface_id TEXT NOT NULL,
 vendor_id TEXT NOT NULL,
 correction_type TEXT NOT NULL,
 old_value TEXT,
 new_value TEXT NOT NULL,
 reason TEXT NOT NULL,
 operator TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY (interface_id) REFERENCES interfaces(id),
 FOREIGN KEY (vendor_id) REFERENCES vendors(id)
 )`);
 db.run(`CREATE INDEX IF NOT EXISTS idx_failure_interface ON failure_records(interface_id)`);
 db.run(`CREATE INDEX IF NOT EXISTS idx_failure_vendor ON failure_records(vendor_id)`);
 db.run(`CREATE INDEX IF NOT EXISTS idx_failure_time ON failure_records(request_time)`);
 db.run(`CREATE INDEX IF NOT EXISTS idx_score_interface ON health_scores(interface_id)`);
 db.run(`CREATE INDEX IF NOT EXISTS idx_score_period ON health_scores(period_start, period_end)`);
 db.run(`CREATE INDEX IF NOT EXISTS idx_action_interface ON disposal_actions(interface_id)`);
 db.run(`CREATE INDEX IF NOT EXISTS idx_action_status ON disposal_actions(status)`);
 });
}
module.exports = db;
