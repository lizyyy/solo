const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'repair.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS dorms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        building TEXT NOT NULL,
        room_number TEXT NOT NULL,
        UNIQUE(building, room_number)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS repair_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        dorm_id INTEGER NOT NULL,
        student_name TEXT NOT NULL,
        student_phone TEXT,
        repair_type TEXT NOT NULL,
        description TEXT NOT NULL,
        images TEXT,
        status TEXT DEFAULT 'pending',
        submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dorm_id) REFERENCES dorms(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        auditor TEXT,
        audit_result TEXT,
        audit_remark TEXT,
        audit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES repair_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        worker TEXT NOT NULL,
        worker_phone TEXT,
        assign_remark TEXT,
        assign_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES repair_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        material_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT,
        is_over_limit INTEGER DEFAULT 0,
        record_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES repair_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        complete_remark TEXT,
        complete_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES repair_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        review_content TEXT,
        need_rework INTEGER DEFAULT 0,
        review_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES repair_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        rework_reason TEXT,
        rework_worker TEXT,
        rework_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES repair_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS merged_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        main_order_id INTEGER NOT NULL,
        merged_order_id INTEGER NOT NULL,
        merge_reason TEXT,
        merge_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (main_order_id) REFERENCES repair_orders(id),
        FOREIGN KEY (merged_order_id) REFERENCES repair_orders(id)
      )`);

      resolve();
    });
  });
};

const insertSampleData = () => {
  return new Promise((resolve, reject) => {
    const dorms = [
      { building: '1号楼', room_number: '101' },
      { building: '1号楼', room_number: '102' },
      { building: '1号楼', room_number: '201' },
      { building: '2号楼', room_number: '101' },
      { building: '2号楼', room_number: '102' },
      { building: '3号楼', room_number: '301' },
    ];

    const placeholders = dorms.map(() => '(?, ?)').join(',');
    const values = dorms.flatMap(d => [d.building, d.room_number]);
    
    db.run(`INSERT OR IGNORE INTO dorms (building, room_number) VALUES ${placeholders}`, values, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
};

module.exports = { db, initDatabase, insertSampleData };
