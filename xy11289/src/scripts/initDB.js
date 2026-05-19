const db = require('../config/database');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS booths (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manager TEXT NOT NULL,
    contact TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipments (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    current_booth_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_booth_id) REFERENCES booths(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS borrow_records (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL,
    from_booth_id TEXT,
    to_booth_id TEXT NOT NULL,
    operator TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    remark TEXT,
    damage_level TEXT,
    damage_fee REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipments(id),
    FOREIGN KEY (from_booth_id) REFERENCES booths(id),
    FOREIGN KEY (to_booth_id) REFERENCES booths(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    record_id TEXT,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    reason TEXT,
    operator TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES borrow_records(id)
  )`);

  console.log('数据库表初始化完成');
});

db.close();
