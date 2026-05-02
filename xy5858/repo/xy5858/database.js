const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'equipment.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'available',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS borrow_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        borrower TEXT NOT NULL,
        borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        expected_return_date DATETIME NOT NULL,
        actual_return_date DATETIME,
        status TEXT DEFAULT 'borrowed',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices (id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_records_device_id ON borrow_records(device_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_records_status ON borrow_records(status)`);

    db.get("SELECT COUNT(*) as count FROM devices", (err, row) => {
      if (err) return;
      if (row.count === 0) {
        const sampleDevices = [
          { name: '投影仪 A', type: '投影仪', description: '便携投影仪，分辨率 1080P' },
          { name: '录音笔 B', type: '录音笔', description: '专业录音笔，续航 8 小时' },
          { name: '备用电脑 C', type: '笔记本电脑', description: 'MacBook Pro，用于应急' }
        ];

        const insertStmt = db.prepare("INSERT INTO devices (name, type, description) VALUES (?, ?, ?)");
        sampleDevices.forEach(device => {
          insertStmt.run(device.name, device.type, device.description);
        });
        insertStmt.finalize();
        console.log('已添加示例设备数据');
      }
    });
  });
}

module.exports = db;
