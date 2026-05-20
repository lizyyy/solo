const db = require('../src/models/database');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      batch_name TEXT NOT NULL,
      material_version TEXT NOT NULL,
      handler TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS claim_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      case_no TEXT NOT NULL,
      policy_no TEXT NOT NULL,
      claimant_name TEXT NOT NULL,
      id_card TEXT,
      claim_amount REAL NOT NULL,
      material_list TEXT,
      policy_data TEXT,
      has_invoice INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      reviewer TEXT,
      review_opinion TEXT,
      review_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS processing_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      handler TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES claim_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_code TEXT UNIQUE NOT NULL,
      rule_name TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      condition_json TEXT NOT NULL,
      action TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_case_no ON claim_records(case_no)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_material_version ON batches(material_version)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_review_opinion ON claim_records(review_opinion)
  `);

  console.log('数据库表创建完成');
});

db.close();
