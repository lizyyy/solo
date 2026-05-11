require('dotenv').config();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'checker',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS outbound_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_items INTEGER DEFAULT 0,
    scanned_items INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    cancelled_by TEXT,
    cancelled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT NOT NULL,
    product_name TEXT NOT NULL,
    expected_qty INTEGER NOT NULL,
    scanned_qty INTEGER DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES outbound_orders(id)
  );

  CREATE TABLE IF NOT EXISTS scan_records (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    item_id TEXT,
    scanner_id TEXT NOT NULL,
    barcode TEXT NOT NULL,
    scan_result TEXT NOT NULL,
    error_type TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES outbound_orders(id),
    FOREIGN KEY (scanner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES outbound_orders(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const adminId = 'admin-001';
const checkerId = 'checker-001';

const existingAdmin = db.prepare('SELECT id FROM users WHERE id = ?').get(adminId);
if (!existingAdmin) {
  const adminPass = bcrypt.hashSync('admin123', 10);
  const checkerPass = bcrypt.hashSync('checker123', 10);
  
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);
  
  insertUser.run(adminId, 'admin', adminPass, 'admin');
  insertUser.run(checkerId, 'checker01', checkerPass, 'checker');
  
  console.log('Default users created:');
  console.log('  admin / admin123 (role: admin)');
  console.log('  checker01 / checker123 (role: checker)');
}

console.log('Database initialized successfully!');
