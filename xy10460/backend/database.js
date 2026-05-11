const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'garbage.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS residents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      address TEXT,
      total_points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS delivery_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resident_id INTEGER NOT NULL,
      garbage_type TEXT NOT NULL,
      weight REAL NOT NULL,
      delivery_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      points INTEGER DEFAULT 0,
      FOREIGN KEY (resident_id) REFERENCES residents(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inspection_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL,
      is_qualified INTEGER NOT NULL DEFAULT 1,
      problem_description TEXT,
      inspect_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_id) REFERENCES delivery_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS points_flow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resident_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      points INTEGER NOT NULL,
      description TEXT,
      record_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      related_id INTEGER,
      FOREIGN KEY (resident_id) REFERENCES residents(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exchange_gifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      points_required INTEGER NOT NULL,
      stock INTEGER DEFAULT 0,
      description TEXT,
      image_url TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exchange_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resident_id INTEGER NOT NULL,
      gift_id INTEGER NOT NULL,
      points_cost INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      reject_reason TEXT,
      apply_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      process_time DATETIME,
      FOREIGN KEY (resident_id) REFERENCES residents(id),
      FOREIGN KEY (gift_id) REFERENCES exchange_gifts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resident_id INTEGER NOT NULL,
      related_id INTEGER NOT NULL,
      related_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      process_result TEXT,
      process_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resident_id) REFERENCES residents(id)
    )`);

    insertInitialData();
  });
}

function insertInitialData() {
  db.get('SELECT COUNT(*) as count FROM residents', (err, row) => {
    if (err) return;
    if (row.count === 0) {
      const residents = [
        ['张三', '13800138001', '幸福小区1号楼101室', 0],
        ['李四', '13800138002', '幸福小区1号楼102室', 0],
        ['王五', '13800138003', '幸福小区2号楼201室', 0]
      ];

      const stmt = db.prepare('INSERT INTO residents (name, phone, address, total_points) VALUES (?, ?, ?, ?)');
      residents.forEach(resident => {
        stmt.run(resident);
      });
      stmt.finalize();

      const gifts = [
        ['洗衣液', 50, 20, '1L装洗衣液', ''],
        ['卫生纸', 30, 50, '一提卫生纸', ''],
        ['大米', 100, 10, '5kg大米', ''],
        ['食用油', 150, 5, '1L食用油', '']
      ];

      const giftStmt = db.prepare('INSERT INTO exchange_gifts (name, points_required, stock, description, image_url) VALUES (?, ?, ?, ?, ?)');
      gifts.forEach(gift => {
        giftStmt.run(gift);
      });
      giftStmt.finalize();
    }
  });
}

module.exports = db;
