const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到SQLite数据库');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS reschedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reschedule_no TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    original_shot_date TEXT NOT NULL,
    new_shot_date TEXT NOT NULL,
    original_route TEXT NOT NULL,
    new_route TEXT NOT NULL,
    scenic_spot TEXT NOT NULL,
    store TEXT NOT NULL,
    person_in_charge TEXT NOT NULL,
    reschedule_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reschedule_fee REAL DEFAULT 0,
    remarks TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_reversed INTEGER DEFAULT 0,
    reversed_from INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reschedule_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reschedule_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    operator TEXT,
    operated_at TEXT NOT NULL,
    FOREIGN KEY (reschedule_id) REFERENCES reschedules(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_reschedule_no ON reschedules(reschedule_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_status ON reschedules(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_store ON reschedules(store)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_person_in_charge ON reschedules(person_in_charge)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_original_shot_date ON reschedules(original_shot_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_new_shot_date ON reschedules(new_shot_date)`);

  console.log('数据库表创建完成');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('数据库连接已关闭');
});