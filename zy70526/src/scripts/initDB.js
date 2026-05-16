const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      data_source TEXT,
      record_count INTEGER,
      fields TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS anonymization_rules (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      rule_type TEXT NOT NULL,
      config TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS risk_samples (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      sample_data TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      risk_type TEXT,
      identified_fields TEXT,
      confidence_score REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS arbitration_opinions (
      id TEXT PRIMARY KEY,
      risk_sample_id TEXT NOT NULL,
      arbitrator TEXT NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (risk_sample_id) REFERENCES risk_samples(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reprocess_tasks (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      rule_id TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      original_input TEXT NOT NULL,
      processing_basis TEXT,
      final_conclusion TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id),
      FOREIGN KEY (rule_id) REFERENCES anonymization_rules(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS arbitration_summaries (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      total_samples INTEGER DEFAULT 0,
      high_risk_count INTEGER DEFAULT 0,
      medium_risk_count INTEGER DEFAULT 0,
      low_risk_count INTEGER DEFAULT 0,
      approved_count INTEGER DEFAULT 0,
      rejected_count INTEGER DEFAULT 0,
      need_reprocess_count INTEGER DEFAULT 0,
      summary TEXT,
      exported_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id)
    )
  `);

  console.log('数据库表初始化完成');
  db.close();
});