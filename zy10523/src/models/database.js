const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'risk-order.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const initDatabase = async () => {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS order_freezes (
        id TEXT PRIMARY KEY,
        order_no TEXT NOT NULL,
        risk_reason TEXT NOT NULL,
        freeze_action TEXT NOT NULL,
        freeze_action_details TEXT,
        reviewer TEXT,
        release_condition TEXT,
        status TEXT NOT NULL DEFAULT 'FROZEN',
        processing_summary TEXT,
        original_input TEXT NOT NULL,
        processing_basis TEXT,
        final_conclusion TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        frozen_at INTEGER NOT NULL,
        reviewed_at INTEGER,
        released_at INTEGER,
        cancelled_at INTEGER,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    await run(`CREATE INDEX IF NOT EXISTS idx_order_freezes_order_no ON order_freezes(order_no)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_order_freezes_status ON order_freezes(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_order_freezes_created_at ON order_freezes(created_at)`);

    await run(`
      CREATE TABLE IF NOT EXISTS freeze_operation_logs (
        id TEXT PRIMARY KEY,
        freeze_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        operator TEXT,
        before_status TEXT,
        after_status TEXT,
        operation_details TEXT NOT NULL,
        original_input TEXT,
        processing_basis TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    await run(`CREATE INDEX IF NOT EXISTS idx_freeze_logs_freeze_id ON freeze_operation_logs(freeze_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_freeze_logs_operation_type ON freeze_operation_logs(operation_type)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_freeze_logs_created_at ON freeze_operation_logs(created_at)`);

    await run(`
      CREATE TABLE IF NOT EXISTS fulfillment_intercepts (
        id TEXT PRIMARY KEY,
        freeze_id TEXT NOT NULL,
        order_no TEXT NOT NULL,
        intercept_type TEXT NOT NULL,
        intercept_status TEXT NOT NULL,
        intercept_details TEXT,
        original_request TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    await run(`CREATE INDEX IF NOT EXISTS idx_intercepts_freeze_id ON fulfillment_intercepts(freeze_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_intercepts_order_no ON fulfillment_intercepts(order_no)`);

    console.log('数据库表初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err);
    throw err;
  }
};

const OrderFreezeStatus = {
  FROZEN: 'FROZEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RELEASED: 'RELEASED',
  CANCELLED: 'CANCELLED',
  MANUALLY_CORRECTED: 'MANUALLY_CORRECTED'
};

const FreezeAction = {
  STOP_FULFILLMENT: 'STOP_FULFILLMENT',
  HOLD_PAYMENT: 'HOLD_PAYMENT',
  SUSPEND_DELIVERY: 'SUSPEND_DELIVERY',
  BLOCK_REFUND: 'BLOCK_REFUND',
  ALL: 'ALL'
};

const OperationType = {
  CREATE: 'CREATE',
  SUBMIT_FOR_REVIEW: 'SUBMIT_FOR_REVIEW',
  REVIEW_APPROVE: 'REVIEW_APPROVE',
  REVIEW_REJECT: 'REVIEW_REJECT',
  RELEASE: 'RELEASE',
  CANCEL: 'CANCEL',
  MANUAL_CORRECT: 'MANUAL_CORRECT',
  INTERCEPT: 'INTERCEPT',
  EXCEPTION: 'EXCEPTION'
};

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase,
  OrderFreezeStatus,
  FreezeAction,
  OperationType
};
