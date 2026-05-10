const { exec, get, run } = require('./database');

function initSchema() {
  exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      contact_person TEXT,
      phone TEXT,
      credit_rating TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      contract_no TEXT NOT NULL UNIQUE,
      contract_name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      signed_date TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER,
      customer_id INTEGER NOT NULL,
      invoice_no TEXT NOT NULL UNIQUE,
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      amount REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      payment_no TEXT NOT NULL UNIQUE,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      allocated_amount REAL NOT NULL,
      allocated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receivable_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      contract_id INTEGER,
      invoice_id INTEGER,
      ledger_type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      due_date TEXT,
      transaction_date TEXT NOT NULL,
      reference_no TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS aging_buckets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      min_days INTEGER NOT NULL,
      max_days INTEGER,
      collection_level TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS invoice_aging (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      bucket_id INTEGER,
      overdue_days INTEGER NOT NULL DEFAULT 0,
      balance REAL NOT NULL,
      aging_date TEXT NOT NULL,
      collection_level TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collection_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      invoice_id INTEGER,
      contract_id INTEGER,
      task_code TEXT NOT NULL UNIQUE,
      collection_level TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      current_status TEXT NOT NULL DEFAULT 'pending',
      current_step TEXT NOT NULL DEFAULT 'initiate',
      reject_count INTEGER DEFAULT 0,
      last_reject_reason TEXT,
      expected_amount REAL,
      priority TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_workflow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      step_order INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_promises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      invoice_id INTEGER,
      promised_amount REAL NOT NULL,
      promised_date TEXT NOT NULL,
      actual_payment_date TEXT,
      is_fulfilled INTEGER DEFAULT 0,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bad_debt_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      bad_debt_amount REAL NOT NULL,
      reason TEXT NOT NULL,
      approved_by TEXT,
      approved_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS report_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL,
      report_date TEXT NOT NULL,
      snapshot_data TEXT NOT NULL,
      generated_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const bucketCountResult = get('SELECT COUNT(*) as count FROM aging_buckets');
  const bucketCount = bucketCountResult?.count || 0;
  
  if (bucketCount === 0) {
    run('INSERT INTO aging_buckets (name, min_days, max_days, collection_level, description) VALUES (?, ?, ?, ?, ?)',
      '未到期', 0, 0, 'none', '未到付款日期');
    run('INSERT INTO aging_buckets (name, min_days, max_days, collection_level, description) VALUES (?, ?, ?, ?, ?)',
      '逾期1-30天', 1, 30, 'level1', '电话催收提醒');
    run('INSERT INTO aging_buckets (name, min_days, max_days, collection_level, description) VALUES (?, ?, ?, ?, ?)',
      '逾期31-60天', 31, 60, 'level2', '正式催款函');
    run('INSERT INTO aging_buckets (name, min_days, max_days, collection_level, description) VALUES (?, ?, ?, ?, ?)',
      '逾期61-90天', 61, 90, 'level3', '法务介入');
    run('INSERT INTO aging_buckets (name, min_days, max_days, collection_level, description) VALUES (?, ?, ?, ?, ?)',
      '逾期90天以上', 91, 99999, 'level4', '坏账评估');
  }
}

module.exports = { initSchema };
