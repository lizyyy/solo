const createTables = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT,
      phone TEXT,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      hourly_rate REAL NOT NULL DEFAULT 0,
      deposit_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batch_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT UNIQUE NOT NULL,
      batch_type TEXT NOT NULL,
      description TEXT,
      imported_by TEXT,
      record_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rental_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      batch_id TEXT,
      order_date TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total_amount REAL DEFAULT 0,
      total_deposit REAL DEFAULT 0,
      total_allocated REAL DEFAULT 0,
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (batch_id) REFERENCES batch_records(batch_id)
    );

    CREATE TABLE IF NOT EXISTS rental_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      planned_start_date TEXT NOT NULL,
      planned_end_date TEXT NOT NULL,
      actual_start_date TEXT,
      actual_end_date TEXT,
      hourly_rate REAL NOT NULL,
      deposit_amount REAL NOT NULL,
      subtotal REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES rental_orders(order_id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usage_id TEXT UNIQUE NOT NULL,
      item_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_hours REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (item_id) REFERENCES rental_items(item_id),
      FOREIGN KEY (member_id) REFERENCES members(member_id)
    );

    CREATE TABLE IF NOT EXISTS expense_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      allocation_id TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      usage_id TEXT,
      equipment_id TEXT NOT NULL,
      allocated_amount REAL NOT NULL DEFAULT 0,
      allocation_ratio REAL NOT NULL DEFAULT 0,
      allocation_type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES rental_orders(order_id),
      FOREIGN KEY (item_id) REFERENCES rental_items(item_id),
      FOREIGN KEY (member_id) REFERENCES members(member_id),
      FOREIGN KEY (usage_id) REFERENCES usage_records(usage_id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deposit_id TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      collected_amount REAL NOT NULL DEFAULT 0,
      refunded_amount REAL DEFAULT 0,
      deducted_amount REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'COLLECTED',
      collected_at TEXT,
      refunded_at TEXT,
      deducted_at TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES rental_orders(order_id),
      FOREIGN KEY (item_id) REFERENCES rental_items(item_id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
    );

    CREATE TABLE IF NOT EXISTS damage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      damage_id TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      reported_by TEXT,
      reported_at TEXT,
      damage_description TEXT NOT NULL,
      repair_cost REAL DEFAULT 0,
      is_allocated INTEGER DEFAULT 0,
      allocated_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES rental_orders(order_id),
      FOREIGN KEY (item_id) REFERENCES rental_items(item_id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
    );

    CREATE TABLE IF NOT EXISTS state_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transition_id TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anomaly_id TEXT UNIQUE NOT NULL,
      anomaly_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'WARNING',
      entity_type TEXT,
      entity_id TEXT,
      description TEXT NOT NULL,
      related_ids TEXT,
      is_resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      resolution_notes TEXT,
      detected_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_rental_orders_status ON rental_orders(status);
    CREATE INDEX IF NOT EXISTS idx_rental_orders_date ON rental_orders(order_date);
    CREATE INDEX IF NOT EXISTS idx_usage_records_time ON usage_records(start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
    CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(anomaly_type);
    CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON anomalies(is_resolved);
  `);
};

module.exports = { createTables };
