const db = require('../config/database');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_number TEXT UNIQUE NOT NULL,
          room_type TEXT NOT NULL,
          floor INTEGER NOT NULL,
          status TEXT DEFAULT 'available' CHECK(status IN ('available', 'occupied', 'maintenance', 'locked')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sales_channels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS lock_reasons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS room_locks (
          id TEXT PRIMARY KEY,
          room_id INTEGER NOT NULL,
          room_number TEXT NOT NULL,
          channel_id INTEGER,
          channel_code TEXT,
          reason_id INTEGER NOT NULL,
          reason_code TEXT NOT NULL,
          lock_time DATETIME NOT NULL,
          unlock_time DATETIME,
          status TEXT NOT NULL CHECK(status IN ('available', 'locking', 'pending_unlock', 'unlocked')),
          operator TEXT NOT NULL,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (room_id) REFERENCES rooms(id),
          FOREIGN KEY (channel_id) REFERENCES sales_channels(id),
          FOREIGN KEY (reason_id) REFERENCES lock_reasons(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS room_lock_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lock_id TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT NOT NULL,
          action TEXT NOT NULL,
          operator TEXT NOT NULL,
          remark TEXT,
          changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lock_id) REFERENCES room_locks(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS import_batches (
          id TEXT PRIMARY KEY,
          total_count INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'processing',
          operator TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS import_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT NOT NULL,
          row_number INTEGER NOT NULL,
          room_number TEXT,
          channel_code TEXT,
          reason_code TEXT,
          unlock_time TEXT,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          lock_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (batch_id) REFERENCES import_batches(id),
          FOREIGN KEY (lock_id) REFERENCES room_locks(id)
        )
      `);

      const rooms = [
        { room_number: '1001', room_type: '标准间', floor: 10 },
        { room_number: '1002', room_type: '标准间', floor: 10 },
        { room_number: '1003', room_type: '大床房', floor: 10 },
        { room_number: '1101', room_type: '套房', floor: 11 },
        { room_number: '1102', room_type: '标准间', floor: 11 },
        { room_number: '1201', room_type: '总统套房', floor: 12 },
      ];

      const stmtRoom = db.prepare('INSERT OR IGNORE INTO rooms (room_number, room_type, floor) VALUES (?, ?, ?)');
      rooms.forEach(room => {
        stmtRoom.run(room.room_number, room.room_type, room.floor);
      });
      stmtRoom.finalize();

      const channels = [
        { code: 'OTA_CTRIP', name: '携程' },
        { code: 'OTA_FLIGGY', name: '飞猪' },
        { code: 'OTA_MEITUAN', name: '美团' },
        { code: 'DIRECT', name: '前台直销' },
        { code: 'WALKIN', name: '散客' },
      ];

      const stmtChannel = db.prepare('INSERT OR IGNORE INTO sales_channels (code, name) VALUES (?, ?)');
      channels.forEach(ch => {
        stmtChannel.run(ch.code, ch.name);
      });
      stmtChannel.finalize();

      const reasons = [
        { code: 'MAINTENANCE', name: '维修保养', description: '房间需要维修保养' },
        { code: 'INTERNAL_USE', name: '内部使用', description: '酒店内部使用' },
        { code: 'COMPLAINT_HANDLE', name: '投诉处理', description: '客人投诉处理预留' },
        { code: 'VIP_RESERVE', name: 'VIP预留', description: '重要客人预留' },
        { code: 'OVERBOOKING', name: '超售预留', description: '超售情况预留' },
        { code: 'CHANNEL_LOCK', name: '渠道锁定', description: '销售渠道已售出' },
      ];

      const stmtReason = db.prepare('INSERT OR IGNORE INTO lock_reasons (code, name, description) VALUES (?, ?, ?)');
      reasons.forEach(r => {
        stmtReason.run(r.code, r.name, r.description);
      });
      stmtReason.finalize();

      console.log('数据库初始化完成');
      resolve();
    });
  });
};

initDatabase().then(() => {
  db.close();
  process.exit(0);
}).catch(err => {
  console.error('初始化失败:', err);
  db.close();
  process.exit(1);
});
