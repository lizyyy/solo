const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '../../data');
const dbPath = path.join(dbDir, 'claims.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_no TEXT UNIQUE NOT NULL,
      operator TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS claim_materials (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      claim_no TEXT UNIQUE NOT NULL,
      policy_no TEXT NOT NULL,
      insured_name TEXT NOT NULL,
      insured_id_card TEXT NOT NULL,
      accident_date DATE NOT NULL,
      claim_amount DECIMAL(15,2) NOT NULL,
      hospital TEXT,
      diagnosis TEXT,
      materials TEXT,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS precheck_results (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL UNIQUE,
      batch_id TEXT NOT NULL,
      category TEXT NOT NULL,
      policy_responsibility TEXT,
      material_gaps TEXT,
      duplicate_claim TEXT,
      reasons TEXT,
      next_actions TEXT,
      needs_manual_review INTEGER DEFAULT 0,
      review_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (claim_id) REFERENCES claim_materials(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS task_status (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      claim_id TEXT,
      status TEXT NOT NULL,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (claim_id) REFERENCES claim_materials(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_claim_policy ON claim_materials(policy_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_claim_idcard ON claim_materials(insured_id_card)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_claim_accident ON claim_materials(accident_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_precheck_category ON precheck_results(category)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_task_status ON task_status(status)`);

  console.log('数据库初始化完成');
});

db.close();
