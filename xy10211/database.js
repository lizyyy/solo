const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'charging-billing.db');
const db = new sqlite3.Database(dbPath);

class DatabaseWrapper {
  constructor(db) {
    this.db = db;
  }

  prepare(sql) {
    return {
      run: (...params) => new Promise((resolve, reject) => {
        this.db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
        });
      }),
      get: (...params) => new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }),
      all: (...params) => new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      })
    };
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  pragma(sql) {
    return new Promise((resolve, reject) => {
      this.db.run(`PRAGMA ${sql}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  transaction(fn) {
    return fn();
  }
}

const dbWrapper = new DatabaseWrapper(db);

function initializeDatabaseSync() {
  db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL`);
    db.run(`PRAGMA foreign_keys = ON`);

    db.run(`
      CREATE TABLE IF NOT EXISTS tariff_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        community_id TEXT NOT NULL,
        name TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(community_id, effective_date)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tariff_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tariff_profile_id INTEGER NOT NULL,
        period_type TEXT NOT NULL CHECK(period_type IN ('peak', 'flat', 'valley')),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        price_per_kwh REAL NOT NULL,
        FOREIGN KEY (tariff_profile_id) REFERENCES tariff_profiles(id),
        UNIQUE(tariff_profile_id, period_type, start_time)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS charging_sessions (
        session_id TEXT PRIMARY KEY,
        community_id TEXT NOT NULL,
        resident_id TEXT NOT NULL,
        charger_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS session_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('created', 'charging', 'paused', 'resumed', 'completed', 'failed', 'reconciled')),
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('charger', 'server', 'manual')),
        request_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES charging_sessions(session_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS raw_charging_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        community_id TEXT NOT NULL,
        resident_id TEXT NOT NULL,
        charger_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        start_kwh REAL NOT NULL,
        end_kwh REAL NOT NULL,
        energy_consumed REAL NOT NULL,
        duration_seconds INTEGER NOT NULL,
        is_retransmit INTEGER DEFAULT 0,
        original_request_id TEXT,
        is_validated INTEGER DEFAULT 0,
        validation_errors TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(request_id, session_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS energy_slices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        raw_record_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        start_kwh REAL NOT NULL,
        end_kwh REAL NOT NULL,
        energy_consumed REAL NOT NULL,
        duration_seconds INTEGER NOT NULL,
        period_type TEXT NOT NULL,
        price_per_kwh REAL NOT NULL,
        slice_amount REAL NOT NULL,
        FOREIGN KEY (session_id) REFERENCES charging_sessions(session_id),
        FOREIGN KEY (raw_record_id) REFERENCES raw_charging_records(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS duplicate_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        original_request_id TEXT NOT NULL,
        duplicate_request_id TEXT NOT NULL,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        resolution TEXT CHECK(resolution IN ('kept_original', 'merged', 'resolved_manually')),
        resolved_at TEXT,
        FOREIGN KEY (session_id) REFERENCES charging_sessions(session_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS bills (
        bill_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        community_id TEXT NOT NULL,
        resident_id TEXT NOT NULL,
        total_energy REAL NOT NULL,
        total_amount REAL NOT NULL,
        peak_energy REAL DEFAULT 0,
        peak_amount REAL DEFAULT 0,
        flat_energy REAL DEFAULT 0,
        flat_amount REAL DEFAULT 0,
        valley_energy REAL DEFAULT 0,
        valley_amount REAL DEFAULT 0,
        reconciliation_status TEXT DEFAULT 'pending' CHECK(reconciliation_status IN ('pending', 'verified', 'needs_review', 'manually_adjusted')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES charging_sessions(session_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS reconciliation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        bill_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        operator TEXT DEFAULT 'system',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES charging_sessions(session_id),
        FOREIGN KEY (bill_id) REFERENCES bills(bill_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS request_deduplication (
        request_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        result TEXT NOT NULL CHECK(result IN ('accepted', 'duplicate', 'rejected', 'merged'))
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_community ON charging_sessions(community_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_resident ON charging_sessions(resident_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_records_session ON raw_charging_records(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_records_timestamp ON raw_charging_records(timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_slices_session ON energy_slices(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_session ON bills(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_status_session ON session_status_history(session_id)`);

    db.get(`SELECT * FROM tariff_profiles WHERE community_id = 'COMM001' AND is_active = 1 LIMIT 1`, (err, row) => {
      if (err) {
        console.error('Error checking default tariff:', err);
        return;
      }
      
      if (!row) {
        db.run(`
          INSERT INTO tariff_profiles (community_id, name, effective_date) 
          VALUES ('COMM001', '默认峰谷电价', '2026-01-01')
        `, function(err) {
          if (err) {
            console.error('Error inserting tariff profile:', err);
            return;
          }
          
          const profileId = this.lastID;
          const periods = [
            [profileId, 'peak', '08:00', '11:00', 1.20],
            [profileId, 'peak', '18:00', '23:00', 1.20],
            [profileId, 'flat', '06:00', '08:00', 0.80],
            [profileId, 'flat', '11:00', '18:00', 0.80],
            [profileId, 'valley', '23:00', '06:00', 0.35]
          ];
          
          const insertPeriod = db.prepare(`
            INSERT INTO tariff_periods (tariff_profile_id, period_type, start_time, end_time, price_per_kwh)
            VALUES (?, ?, ?, ?, ?)
          `);
          
          periods.forEach(p => insertPeriod.run(p));
        });
      }
    });
  });
}

initializeDatabaseSync();

module.exports = dbWrapper;
