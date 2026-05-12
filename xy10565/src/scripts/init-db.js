const dbManager = require('../db/database');
const { v4: uuidv4 } = require('uuid');

async function initializeDatabase() {
  await dbManager.initialize();
  
  console.log('开始初始化数据库...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      original_warranty_months INTEGER DEFAULT 12,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      sn TEXT NOT NULL UNIQUE,
      product_id TEXT NOT NULL,
      is_new INTEGER DEFAULT 1,
      status TEXT DEFAULT 'AVAILABLE',
      warranty_start_date TEXT,
      warranty_end_date TEXT,
      current_owner_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_records (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      change_type TEXT NOT NULL,
      quantity_change INTEGER DEFAULT 0,
      reference_id TEXT,
      reason TEXT,
      operator TEXT,
      before_status TEXT,
      after_status TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS replacement_applications (
      id TEXT PRIMARY KEY,
      application_no TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      original_device_id TEXT NOT NULL,
      target_product_id TEXT NOT NULL,
      replacement_reason TEXT,
      application_source TEXT DEFAULT 'CUSTOMER',
      applicant TEXT,
      status TEXT DEFAULT 'APPLICATION_PENDING',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS fault_audits (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      fault_description TEXT,
      fault_type TEXT,
      auditor TEXT,
      audit_result TEXT DEFAULT 'PENDING',
      audit_notes TEXT,
      confirm_need_replacement INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      audited_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_allocations (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      new_device_id TEXT NOT NULL,
      allocation_status TEXT DEFAULT 'ALLOCATED',
      allocated_at TEXT DEFAULT (datetime('now')),
      released_at TEXT,
      operator TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      tracking_no TEXT,
      shipping_company TEXT,
      shipping_address TEXT,
      status TEXT DEFAULT 'SHIPPING',
      shipped_at TEXT,
      delivered_at TEXT,
      operator TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recycle_records (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      original_device_id TEXT NOT NULL,
      recycle_tracking_no TEXT,
      recycle_company TEXT,
      recycle_address TEXT,
      status TEXT DEFAULT 'PENDING',
      expected_receive_date TEXT,
      actual_receive_date TEXT,
      inspection_notes TEXT,
      operator TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS warranty_records (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      original_warranty_start TEXT,
      original_warranty_end TEXT,
      new_warranty_start TEXT,
      new_warranty_end TEXT,
      calculation_mode TEXT,
      extension_days INTEGER DEFAULT 0,
      notes TEXT,
      operator TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      module TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      operator TEXT,
      reason TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      application_id TEXT,
      operation_type TEXT NOT NULL,
      module TEXT NOT NULL,
      operator TEXT,
      before_data TEXT,
      after_data TEXT,
      diff_summary TEXT,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS idempotency_records (
      id TEXT PRIMARY KEY,
      request_key TEXT NOT NULL UNIQUE,
      application_id TEXT,
      operation TEXT NOT NULL,
      response_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `;

  dbManager.exec(createTableSQL);
  
  console.log('数据库表结构初始化完成！');
  
  dbManager.close();
}

if (require.main === module) {
  initializeDatabase().catch(err => {
    console.error('初始化失败:', err);
    process.exit(1);
  });
}

module.exports = initializeDatabase;
