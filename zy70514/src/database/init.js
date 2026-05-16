const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/api_budget_freeze.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS customer_accounts (
      account_id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      total_budget REAL DEFAULT 0,
      used_budget REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_groups (
      group_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      group_name TEXT NOT NULL,
      description TEXT,
      budget_limit REAL DEFAULT 0,
      used_budget REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS budget_freezes (
      freeze_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      group_id TEXT,
      freeze_amount REAL NOT NULL,
      freeze_reason TEXT NOT NULL,
      freeze_category TEXT NOT NULL,
      complaint_id TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending_review',
      original_request TEXT,
      processing_basis TEXT,
      final_conclusion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id),
      FOREIGN KEY (group_id) REFERENCES api_groups(group_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS freeze_operations (
      operation_id TEXT PRIMARY KEY,
      freeze_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (freeze_id) REFERENCES budget_freezes(freeze_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS thaw_approvals (
      approval_id TEXT PRIMARY KEY,
      freeze_id TEXT NOT NULL,
      applicant_id TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      thaw_reason TEXT NOT NULL,
      proposed_amount REAL NOT NULL,
      approver_id TEXT,
      approver_name TEXT,
      approval_remarks TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      FOREIGN KEY (freeze_id) REFERENCES budget_freezes(freeze_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usage_reports (
      report_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      group_id TEXT,
      report_date TEXT NOT NULL,
      total_calls INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      frozen_amount REAL DEFAULT 0,
      available_budget REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id),
      FOREIGN KEY (group_id) REFERENCES api_groups(group_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS manual_corrections (
      correction_id TEXT PRIMARY KEY,
      freeze_id TEXT,
      account_id TEXT NOT NULL,
      group_id TEXT,
      correction_type TEXT NOT NULL,
      original_value REAL,
      corrected_value REAL NOT NULL,
      reason TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      approver_id TEXT,
      approver_name TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (freeze_id) REFERENCES budget_freezes(freeze_id),
      FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_call_logs (
      call_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      api_path TEXT NOT NULL,
      call_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      cost REAL NOT NULL,
      status TEXT NOT NULL,
      rejected_reason TEXT,
      FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id),
      FOREIGN KEY (group_id) REFERENCES api_groups(group_id)
    )
  `);

  console.log('数据库初始化完成');
});

db.close();
