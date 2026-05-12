const db = require('./db');

const initSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS spare_parts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      current_stock INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      criticality TEXT NOT NULL,
      department TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS equipment_parts (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,
      part_id TEXT NOT NULL,
      is_main_part INTEGER DEFAULT 1,
      created_at INTEGER,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      FOREIGN KEY (part_id) REFERENCES spare_parts(id),
      UNIQUE(equipment_id, part_id)
    );

    CREATE TABLE IF NOT EXISTS consumption_records (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL,
      equipment_id TEXT,
      quantity INTEGER NOT NULL,
      consumption_date INTEGER,
      created_at INTEGER,
      FOREIGN KEY (part_id) REFERENCES spare_parts(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_cycles (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL,
      supplier TEXT,
      cycle_days INTEGER NOT NULL,
      is_primary INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (part_id) REFERENCES spare_parts(id)
    );

    CREATE TABLE IF NOT EXISTS alternative_parts (
      id TEXT PRIMARY KEY,
      original_part_id TEXT NOT NULL,
      alternative_part_id TEXT NOT NULL,
      compatibility_status TEXT NOT NULL,
      limit_equipment_ids TEXT,
      created_at INTEGER,
      FOREIGN KEY (original_part_id) REFERENCES spare_parts(id),
      FOREIGN KEY (alternative_part_id) REFERENCES spare_parts(id),
      UNIQUE(original_part_id, alternative_part_id)
    );

    CREATE TABLE IF NOT EXISTS min_stock_rules (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL,
      equipment_id TEXT,
      min_quantity INTEGER NOT NULL,
      safety_factor REAL DEFAULT 1.2,
      calculated_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (part_id) REFERENCES spare_parts(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      in_transit_quantity INTEGER DEFAULT 0,
      expected_arrival_date INTEGER,
      status TEXT DEFAULT 'IN_TRANSIT',
      created_at INTEGER,
      FOREIGN KEY (part_id) REFERENCES spare_parts(id)
    );

    CREATE TABLE IF NOT EXISTS receptions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      requester TEXT,
      equipment_id TEXT,
      part_id TEXT NOT NULL,
      requested_quantity INTEGER NOT NULL,
      actual_quantity INTEGER DEFAULT 0,
      used_alternative_part_id TEXT,
      status TEXT NOT NULL,
      current_step TEXT,
      idempotent_key TEXT UNIQUE,
      callback_count INTEGER DEFAULT 0,
      last_callback_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (part_id) REFERENCES spare_parts(id),
      FOREIGN KEY (used_alternative_part_id) REFERENCES spare_parts(id)
    );

    CREATE TABLE IF NOT EXISTS reception_status_history (
      id TEXT PRIMARY KEY,
      reception_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT,
      reason TEXT,
      created_at INTEGER,
      FOREIGN KEY (reception_id) REFERENCES receptions(id)
    );

    CREATE TABLE IF NOT EXISTS manual_corrections (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      before_value TEXT,
      after_value TEXT,
      diff TEXT,
      operator TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS stock_alerts (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL,
      alert_level TEXT NOT NULL,
      current_stock INTEGER,
      min_stock INTEGER,
      in_transit_quantity INTEGER,
      affected_equipments TEXT,
      created_at INTEGER,
      is_resolved INTEGER DEFAULT 0,
      FOREIGN KEY (part_id) REFERENCES spare_parts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_spare_parts_code ON spare_parts(code);
    CREATE INDEX IF NOT EXISTS idx_consumption_part ON consumption_records(part_id);
    CREATE INDEX IF NOT EXISTS idx_receptions_status ON receptions(status);
    CREATE INDEX IF NOT EXISTS idx_receptions_idempotent ON receptions(idempotent_key);
    CREATE INDEX IF NOT EXISTS idx_history_reception ON reception_status_history(reception_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_part ON stock_alerts(part_id);
  `);
};

module.exports = initSchema;
