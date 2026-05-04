const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'elevator.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS buildings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          building_code TEXT UNIQUE NOT NULL,
          building_name TEXT NOT NULL,
          total_floors INTEGER NOT NULL,
          units_per_floor INTEGER NOT NULL,
          total_units INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS households (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          building_id INTEGER NOT NULL,
          unit_number TEXT NOT NULL,
          floor INTEGER NOT NULL,
          owner_name TEXT,
          phone TEXT,
          area REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (building_id) REFERENCES buildings(id),
          UNIQUE(building_id, unit_number)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS signatures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          household_id INTEGER NOT NULL,
          is_agree BOOLEAN NOT NULL,
          signature_date DATE NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (household_id) REFERENCES households(id),
          UNIQUE(household_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS construction_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_name TEXT NOT NULL,
          building_id INTEGER NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          work_hours_start TEXT NOT NULL,
          work_hours_end TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (building_id) REFERENCES buildings(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS complaints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          building_id INTEGER NOT NULL,
          household_id INTEGER,
          complaint_date DATE NOT NULL,
          complaint_type TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          resolution TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (building_id) REFERENCES buildings(id),
          FOREIGN KEY (household_id) REFERENCES households(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS validation_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_name TEXT UNIQUE NOT NULL,
          rule_description TEXT,
          is_active BOOLEAN DEFAULT 1,
          rule_config TEXT
        )
      `);

      const insertRules = db.prepare(`
        INSERT OR IGNORE INTO validation_rules (rule_name, rule_description, is_active, rule_config)
        VALUES (?, ?, 1, ?)
      `);

      insertRules.run(
        'duplicate_signature_check',
        '防止同一户重复签字',
        JSON.stringify({})
      );

      insertRules.run(
        'low_floor_opposition_check',
        '检查低楼层反对是否被记录',
        JSON.stringify({ "low_floor_threshold": 3 })
      );

      insertRules.run(
        'construction_time_conflict_check',
        '检查施工时间与高考/夜间禁噪冲突',
        JSON.stringify({
          "gaokao_dates": [
            { "start": "2026-06-07", "end": "2026-06-09" },
            { "start": "2027-06-07", "end": "2027-06-09" }
          ],
          "night_hours": { "start": "22:00", "end": "06:00" },
          "silent_periods": [
            { "start": "12:00", "end": "14:00", "description": "午休时间" }
          ]
        })
      );

      insertRules.run(
        'signature_ratio_check',
        '检查签字比例是否达到要求',
        JSON.stringify({
          "required_ratio": 0.7,
          "required_by_floor": true
        })
      );

      insertRules.finalize();

      console.log('数据库初始化完成');
      resolve();
    });
  });
};

module.exports = {
  db,
  initDatabase
};
