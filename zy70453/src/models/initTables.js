const { getDatabase } = require('../config/database');

function createTables() {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    const tables = [
      `CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT UNIQUE,
        email TEXT,
        membership_type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        expire_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS renewal_transactions (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        amount REAL NOT NULL,
        plan_months INTEGER NOT NULL,
        payment_method TEXT,
        transaction_type TEXT DEFAULT 'offline',
        status TEXT DEFAULT 'completed',
        rollback_evidence TEXT,
        boundary_input TEXT,
        processed_result TEXT,
        operator_id TEXT,
        operator_name TEXT,
        remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id)
      )`,
      `CREATE TABLE IF NOT EXISTS lab_samples (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        sample_type TEXT NOT NULL,
        sample_no TEXT UNIQUE,
        manual_remark TEXT,
        status TEXT DEFAULT 'pending',
        operator_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id)
      )`,
      `CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        operator_id TEXT,
        operator_name TEXT,
        action_details TEXT,
        result_summary TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS batch_operations (
        id TEXT PRIMARY KEY,
        operation_name TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        item_details TEXT,
        candidate_list TEXT,
        status TEXT DEFAULT 'pending',
        operator_id TEXT,
        operator_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_renewal_member ON renewal_transactions(member_id)`,
      `CREATE INDEX IF NOT EXISTS idx_renewal_status ON renewal_transactions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_sample_member ON lab_samples(member_id)`,
      `CREATE INDEX IF NOT EXISTS idx_log_operation ON operation_logs(operation_type)`
    ];

    let completed = 0;
    const total = tables.length;

    db.serialize(() => {
      tables.forEach((sql, index) => {
        db.run(sql, (err) => {
          if (err) {
            reject(err);
            return;
          }
          completed++;
          if (completed === total) {
            console.log('数据库表创建完成');
            resolve();
          }
        });
      });
    });
  });
}

module.exports = { createTables };