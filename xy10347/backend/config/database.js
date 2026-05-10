const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/commission.db');

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
    // 团长表
    db.run(`CREATE TABLE IF NOT EXISTS team_leaders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      commission_rate REAL DEFAULT 0.2,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 课程表
    db.run(`CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      original_price REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 订单表
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      course_id INTEGER,
      course_name TEXT,
      student_name TEXT,
      student_phone TEXT,
      original_price REAL NOT NULL,
      final_price REAL NOT NULL,
      payment_time TEXT,
      team_leader_id INTEGER,
      team_leader_name TEXT,
      commission_rate REAL DEFAULT 0.2,
      commission_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      refund_amount REAL DEFAULT 0,
      is_settled INTEGER DEFAULT 0,
      settlement_id INTEGER,
      settlement_period TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_leader_id) REFERENCES team_leaders (id),
      FOREIGN KEY (course_id) REFERENCES courses (id)
    )`);

    // 结算表
    db.run(`CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period TEXT NOT NULL,
      team_leader_id INTEGER,
      team_leader_name TEXT,
      total_orders INTEGER DEFAULT 0,
      total_amount REAL DEFAULT 0,
      total_commission REAL DEFAULT 0,
      refund_commission REAL DEFAULT 0,
      net_commission REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_leader_id) REFERENCES team_leaders (id)
    )`);

    // 改价申请表
    db.run(`CREATE TABLE IF NOT EXISTS price_change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      original_price REAL NOT NULL,
      requested_price REAL NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id)
    )`);

    // 退款记录表
    db.run(`CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      refund_amount REAL NOT NULL,
      refund_time TEXT DEFAULT CURRENT_TIMESTAMP,
      refund_reason TEXT,
      commission_deduction REAL NOT NULL,
      is_settled_refund INTEGER DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders (id)
    )`);

    // 创建索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_orders_team_leader ON orders(team_leader_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_orders_payment_time ON orders(payment_time)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(period)`);
  });
}

module.exports = db;
