const db = require('./database');

function initDatabase(callback) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT UNIQUE NOT NULL,
        owner_name TEXT,
        owner_phone TEXT,
        balance DECIMAL(10,2) DEFAULT 0.00,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS monthly_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_name TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        duration_days INTEGER NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS vehicle_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        plan_id INTEGER NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0.00,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
        FOREIGN KEY (plan_id) REFERENCES monthly_plans(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS gate_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        plate_number TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_time DATETIME NOT NULL,
        gate_id TEXT,
        direction TEXT,
        processed INTEGER DEFAULT 0,
        deduplicated INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS deduction_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deduction_no TEXT UNIQUE NOT NULL,
        plate_number TEXT NOT NULL,
        vehicle_id INTEGER,
        subscription_id INTEGER,
        event_id TEXT,
        amount DECIMAL(10,2) NOT NULL,
        deduction_type TEXT NOT NULL,
        deduction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        balance_before DECIMAL(10,2),
        balance_after DECIMAL(10,2),
        status TEXT DEFAULT 'success',
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
        FOREIGN KEY (subscription_id) REFERENCES vehicle_subscriptions(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS supplementary_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplementary_no TEXT UNIQUE NOT NULL,
        plate_number TEXT NOT NULL,
        original_event_id TEXT,
        amount DECIMAL(10,2) NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        applicant TEXT,
        reviewer TEXT,
        review_remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        deducted_at DATETIME
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS reconciliation_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        summary_date DATE UNIQUE NOT NULL,
        total_renewals INTEGER DEFAULT 0,
        renewal_amount DECIMAL(10,2) DEFAULT 0.00,
        total_temporary_deductions INTEGER DEFAULT 0,
        temporary_amount DECIMAL(10,2) DEFAULT 0.00,
        total_gate_events INTEGER DEFAULT 0,
        total_supplementary INTEGER DEFAULT 0,
        supplementary_amount DECIMAL(10,2) DEFAULT 0.00,
        discrepancy_amount DECIMAL(10,2) DEFAULT 0.00,
        status TEXT DEFAULT 'pending',
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exception_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exception_type TEXT NOT NULL,
        raw_input TEXT,
        error_message TEXT,
        processing_result TEXT,
        api_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_gate_events_plate ON gate_events(plate_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_gate_events_time ON gate_events(event_time)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_deduction_plate ON deduction_records(plate_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_supplementary_plate ON supplementary_deductions(plate_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_supplementary_status ON supplementary_deductions(status)`, callback);
  });
}

module.exports = initDatabase;
