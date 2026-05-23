const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = require('../config/database');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      age INTEGER,
      weight REAL,
      owner_name TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      check_in_date DATETIME NOT NULL,
      check_out_date DATETIME NOT NULL,
      room_number TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS medication_plans (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      pet_id TEXT NOT NULL,
      medication_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      dosage_unit TEXT NOT NULL,
      frequency TEXT NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      administration_method TEXT,
      version INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT 1,
      created_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shift_executions (
      id TEXT PRIMARY KEY,
      medication_plan_id TEXT NOT NULL,
      scheduled_time DATETIME NOT NULL,
      shift_type TEXT NOT NULL,
      actual_time DATETIME,
      status TEXT DEFAULT 'pending',
      administered_by TEXT,
      actual_dosage TEXT,
      notes TEXT,
      has_alarm BOOLEAN DEFAULT 0,
      alarm_acknowledged BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medication_plan_id) REFERENCES medication_plans(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS change_confirmations (
      id TEXT PRIMARY KEY,
      request_id TEXT UNIQUE NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      change_type TEXT NOT NULL,
      original_data TEXT,
      new_data TEXT NOT NULL,
      status TEXT DEFAULT 'pending_review',
      requested_by TEXT,
      reviewed_by TEXT,
      reviewed_at DATETIME,
      review_notes TEXT,
      compensation_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS care_reports (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      pet_id TEXT NOT NULL,
      report_date DATE NOT NULL,
      content TEXT NOT NULL,
      generated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      endpoint TEXT,
      method TEXT,
      original_input TEXT NOT NULL,
      error_message TEXT,
      processing_result TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_pet_id ON orders(pet_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_medication_plans_order_id ON medication_plans(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shift_executions_plan_id ON shift_executions(medication_plan_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shift_executions_status ON shift_executions(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_change_confirmations_status ON change_confirmations(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_change_confirmations_request_id ON change_confirmations(request_id)`);

  console.log('数据库表初始化完成');
});

db.close();
