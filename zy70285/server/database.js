const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'inspection.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      manager TEXT,
      authorized BOOLEAN DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      inspector TEXT NOT NULL,
      inspection_date TEXT NOT NULL,
      photos TEXT,
      problems TEXT,
      overall_score REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      photos TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_to TEXT,
      deadline TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rectifications (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      rectifier TEXT,
      rectification_date TEXT,
      photos TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (problem_id) REFERENCES problems(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      review_date TEXT NOT NULL,
      photos TEXT,
      comments TEXT NOT NULL,
      passed BOOLEAN DEFAULT 0,
      score REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (problem_id) REFERENCES problems(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS validations (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      validation_type TEXT NOT NULL,
      result TEXT NOT NULL,
      details TEXT,
      errors TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.get("SELECT COUNT(*) as count FROM stores", (err, row) => {
    if (row.count === 0) {
      const now = new Date().toISOString();
      const stores = [
        ['ST001', '北京朝阳店', 'S001', '北京市朝阳区建国路88号', 'active', '张三', 1, now, now],
        ['ST002', '上海浦东店', 'S002', '上海市浦东新区陆家嘴', 'active', '李四', 1, now, now],
        ['ST003', '深圳南山店', 'S003', '深圳市南山区科技园', 'active', '王五', 0, now, now],
        ['ST004', '广州天河店', 'S004', '广州市天河区珠江新城', 'inactive', '赵六', 1, now, now]
      ];
      
      const stmt = db.prepare(`
        INSERT INTO stores (id, name, code, address, status, manager, authorized, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stores.forEach(s => stmt.run(s));
      stmt.finalize();
    }
  });
});

module.exports = db;
