const db = require('../config/database');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON;');
      
      db.run(`CREATE TABLE IF NOT EXISTS idempotency (
        request_id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        response_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS fish_groups (
        id TEXT PRIMARY KEY,
        species TEXT NOT NULL,
        species_name TEXT NOT NULL,
        count INTEGER NOT NULL CHECK (count >= 0),
        tank_id TEXT,
        health_status TEXT DEFAULT 'healthy',
        quarantine_status TEXT DEFAULT 'none',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tank_id) REFERENCES tanks(id)
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS tanks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('main', 'quarantine', 'hospital')),
        capacity INTEGER NOT NULL CHECK (capacity > 0),
        current_occupancy INTEGER DEFAULT 0 CHECK (current_occupancy >= 0),
        water_ph REAL CHECK (water_ph BETWEEN 0 AND 14),
        water_temperature REAL,
        water_salinity REAL,
        water_quality_score INTEGER DEFAULT 100 CHECK (water_quality_score BETWEEN 0 AND 100),
        is_quarantine_ready INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS isolation_rules (
        id TEXT PRIMARY KEY,
        disease_name TEXT NOT NULL,
        affected_species TEXT,
        required_tank_type TEXT NOT NULL CHECK (required_tank_type IN ('quarantine', 'hospital')),
        min_ph REAL,
        max_ph REAL,
        min_temperature REAL,
        max_temperature REAL,
        max_salinity REAL,
        min_quality_score INTEGER,
        quarantine_days INTEGER DEFAULT 14,
        priority INTEGER DEFAULT 1 CHECK (priority >= 1),
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS treatment_records (
        id TEXT PRIMARY KEY,
        fish_group_id TEXT NOT NULL,
        tank_id TEXT,
        disease TEXT NOT NULL,
        treatment_plan TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'failed')),
        notes TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fish_group_id) REFERENCES fish_groups(id),
        FOREIGN KEY (tank_id) REFERENCES tanks(id)
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS transfer_transactions (
        id TEXT PRIMARY KEY,
        fish_group_id TEXT NOT NULL,
        from_tank_id TEXT,
        to_tank_id TEXT,
        transfer_count INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'failed')),
        scheduled_at DATETIME,
        executed_at DATETIME,
        operator TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fish_group_id) REFERENCES fish_groups(id),
        FOREIGN KEY (from_tank_id) REFERENCES tanks(id),
        FOREIGN KEY (to_tank_id) REFERENCES tanks(id)
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS risk_reports (
        id TEXT PRIMARY KEY,
        fish_group_id TEXT NOT NULL,
        disease TEXT,
        risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
        risk_score INTEGER DEFAULT 0,
        assessment_date DATE NOT NULL,
        affected_count INTEGER DEFAULT 0,
        spread_risk TEXT,
        recommendations TEXT,
        is_resolved INTEGER DEFAULT 0,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fish_group_id) REFERENCES fish_groups(id)
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS quarantine_sessions (
        id TEXT PRIMARY KEY,
        fish_group_id TEXT NOT NULL,
        tank_id TEXT NOT NULL,
        start_date DATE NOT NULL,
        planned_end_date DATE,
        actual_end_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        disease TEXT,
        rule_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fish_group_id) REFERENCES fish_groups(id),
        FOREIGN KEY (tank_id) REFERENCES tanks(id),
        FOREIGN KEY (rule_id) REFERENCES isolation_rules(id)
      )`);

      resolve();
    });
  });
};

module.exports = { initDatabase };
