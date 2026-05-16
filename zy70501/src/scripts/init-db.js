const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS idempotent_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_no TEXT NOT NULL UNIQUE,
        business_type TEXT NOT NULL,
        idempotent_key TEXT NOT NULL,
        time_window INTEGER NOT NULL DEFAULT 600,
        payload TEXT NOT NULL,
        payload_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        result TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expired_at INTEGER NOT NULL
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_idempotent_key ON idempotent_requests(idempotent_key)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_request_no ON idempotent_requests(request_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_status ON idempotent_requests(status)`);

      db.run(`CREATE TABLE IF NOT EXISTS mediation_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        request_no TEXT NOT NULL,
        action TEXT NOT NULL,
        operator TEXT DEFAULT 'system',
        reason TEXT,
        before_status TEXT,
        after_status TEXT,
        original_input TEXT,
        processing_basis TEXT,
        final_conclusion TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (request_id) REFERENCES idempotent_requests(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_mediation_request_no ON mediation_records(request_no)`);

      console.log('数据库表创建成功');
      resolve();
    });
  });
};

createTables().then(() => {
  db.close();
  console.log('数据库初始化完成');
}).catch((err) => {
  console.error('数据库初始化失败:', err);
  db.close();
});
