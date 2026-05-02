const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'storage.db');

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
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT NOT NULL,
        resident_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        storage_type TEXT NOT NULL,
        receiver_name TEXT,
        valid_from TEXT NOT NULL,
        valid_to TEXT NOT NULL,
        remarks TEXT,
        status TEXT NOT NULL DEFAULT '待领取',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        received_at TEXT,
        received_by TEXT
      )
    `, (err) => {
      if (err) {
        console.error('创建表失败:', err.message);
      } else {
        console.log('表 records 已就绪');
      }
    });

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_room_phone ON records(room_number, phone)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_status ON records(status)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_phone ON records(phone)
    `);
  });
}

module.exports = db;
