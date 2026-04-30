const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'materials.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      total_quantity INTEGER DEFAULT 0,
      available_quantity INTEGER DEFAULT 0,
      unit TEXT DEFAULT '个',
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS borrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      resident_name TEXT NOT NULL,
      resident_phone TEXT,
      borrow_quantity INTEGER DEFAULT 1,
      expected_return_date DATE,
      actual_return_date DATETIME,
      return_remark TEXT,
      status TEXT DEFAULT 'borrowed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      material_id INTEGER,
      borrow_record_id INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id)
    )
  `);

  const stmt = db.prepare('INSERT OR IGNORE INTO materials (id, name, category, total_quantity, available_quantity, unit, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(1, '折叠桌', '桌椅类', 20, 20, '张', '社区活动用折叠桌', 'active');
  stmt.run(2, '折叠椅', '桌椅类', 50, 50, '把', '社区活动用折叠椅', 'active');
  stmt.run(3, '音响设备', '音响灯光', 2, 2, '套', '便携式音响系统', 'active');
  stmt.run(4, '投影仪', '电子设备', 3, 3, '台', '高清投影仪', 'active');
  stmt.run(5, '帐篷', '遮阳防雨', 5, 5, '顶', '户外活动帐篷', 'active');
  stmt.finalize();

  const logStmt = db.prepare('INSERT OR IGNORE INTO operation_logs (id, operation_type, material_id, description) VALUES (?, ?, ?, ?)');
  logStmt.run(1, 'register', 1, '初始化物资：折叠桌（20张）');
  logStmt.run(2, 'register', 2, '初始化物资：折叠椅（50把）');
  logStmt.run(3, 'register', 3, '初始化物资：音响设备（2套）');
  logStmt.run(4, 'register', 4, '初始化物资：投影仪（3台）');
  logStmt.run(5, 'register', 5, '初始化物资：帐篷（5顶）');
  logStmt.finalize();
});

module.exports = db;
