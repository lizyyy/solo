const initSchema = (db) => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      batch_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      handler TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      vin TEXT UNIQUE NOT NULL,
      plate_no TEXT,
      brand TEXT,
      model TEXT,
      color TEXT,
      initial_mileage REAL,
      current_mileage REAL,
      fuel_card_balance REAL,
      status TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS borrow_return_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      vehicle_id INTEGER,
      vin TEXT,
      sales_consultant TEXT NOT NULL,
      test_route TEXT,
      customer_name TEXT,
      borrow_time DATETIME NOT NULL,
      expected_return_time DATETIME,
      actual_return_time DATETIME,
      start_mileage REAL,
      end_mileage REAL,
      start_fuel_balance REAL,
      end_fuel_balance REAL,
      status TEXT DEFAULT 'borrowed',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS violation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      vehicle_id INTEGER,
      vin TEXT,
      violation_time DATETIME NOT NULL,
      violation_location TEXT,
      violation_type TEXT,
      fine_amount REAL,
      deduction_points INTEGER,
      handler TEXT,
      attribution_result TEXT,
      remark TEXT,
      receipt_file TEXT,
      processed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL,
      record_id INTEGER,
      exception_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      handler TEXT NOT NULL,
      handle_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      operator TEXT NOT NULL,
      detail TEXT,
      before_data TEXT,
      after_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mileage_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      vin TEXT,
      record_id INTEGER,
      record_type TEXT,
      mileage REAL NOT NULL,
      mileage_change REAL,
      source TEXT NOT NULL,
      source_batch TEXT,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_records_consultant ON borrow_return_records(sales_consultant)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_records_route ON borrow_return_records(test_route)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_mileage_vehicle ON mileage_tracking(vehicle_id)`);
  });
};

module.exports = initSchema;