const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'refund.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库打开失败:', err.message);
  } else {
    console.log('数据库已打开:', dbPath);
  }
});

const initDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      created_at INTEGER NOT NULL,
      paid_at INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      refund_no TEXT UNIQUE NOT NULL,
      payment_id TEXT NOT NULL,
      payment_order_no TEXT NOT NULL,
      amount REAL NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      operator TEXT,
      reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS channel_status (
      id TEXT PRIMARY KEY,
      refund_id TEXT NOT NULL,
      channel_refund_id TEXT,
      status TEXT NOT NULL,
      channel_response TEXT,
      requested_at INTEGER NOT NULL,
      responded_at INTEGER,
      FOREIGN KEY (refund_id) REFERENCES refunds(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      refund_id TEXT,
      action TEXT NOT NULL,
      request_data TEXT,
      response_data TEXT,
      operator TEXT,
      responsibility_node TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (refund_id) REFERENCES refunds(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS manual_reviews (
      id TEXT PRIMARY KEY,
      refund_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      comment TEXT NOT NULL,
      decision TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (refund_id) REFERENCES refunds(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      refund_id TEXT UNIQUE NOT NULL,
      receipt_data TEXT NOT NULL,
      archived_at INTEGER NOT NULL,
      FOREIGN KEY (refund_id) REFERENCES refunds(id)
    )`);

    console.log('数据库表初始化完成');
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  initDatabase,
  dbRun,
  dbGet,
  dbAll,
  uuidv4
};
