const db = require('../models/database');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS cards (
    card_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    balance REAL DEFAULT 0,
    status TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recharge_orders (
    order_id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    amount REAL NOT NULL,
    recharge_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    operator TEXT,
    remark TEXT,
    idempotency_key TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(card_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS offline_transactions (
    tx_id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    amount REAL NOT NULL,
    canteen_id TEXT NOT NULL,
    canteen_name TEXT NOT NULL,
    device_id TEXT NOT NULL,
    tx_time DATETIME NOT NULL,
    upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    idempotency_key TEXT UNIQUE,
    remark TEXT,
    FOREIGN KEY (card_id) REFERENCES cards(card_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS freeze_logs (
    log_id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    operator TEXT NOT NULL,
    before_status TEXT NOT NULL,
    after_status TEXT NOT NULL,
    effective_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(card_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS duplicate_deductions (
    dedup_id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    original_tx_id TEXT NOT NULL,
    duplicate_tx_id TEXT NOT NULL,
    detected_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'detected',
    confidence REAL NOT NULL,
    match_criteria TEXT NOT NULL,
    handler TEXT,
    handle_time DATETIME,
    handle_result TEXT,
    remark TEXT,
    FOREIGN KEY (card_id) REFERENCES cards(card_id),
    FOREIGN KEY (original_tx_id) REFERENCES offline_transactions(tx_id),
    FOREIGN KEY (duplicate_tx_id) REFERENCES offline_transactions(tx_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS refund_records (
    refund_id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    related_tx_id TEXT,
    related_order_id TEXT,
    amount REAL NOT NULL,
    refund_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    operator TEXT NOT NULL,
    reviewer TEXT,
    status TEXT DEFAULT 'pending',
    review_time DATETIME,
    review_remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(card_id),
    FOREIGN KEY (related_tx_id) REFERENCES offline_transactions(tx_id),
    FOREIGN KEY (related_order_id) REFERENCES recharge_orders(order_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    log_id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operator TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    result TEXT NOT NULL,
    fail_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS canteen_reconciliation (
    recon_id TEXT PRIMARY KEY,
    canteen_id TEXT NOT NULL,
    canteen_name TEXT NOT NULL,
    recon_date DATE NOT NULL,
    total_transactions INTEGER DEFAULT 0,
    total_amount REAL DEFAULT 0,
    system_amount REAL DEFAULT 0,
    difference REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    operator TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(canteen_id, recon_date)
  )`);

  console.log('数据库表创建完成');
});

db.close();
