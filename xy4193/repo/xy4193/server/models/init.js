const db = require('../config/database');

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 献血者表
      db.run(`
        CREATE TABLE IF NOT EXISTS donors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          donor_code TEXT UNIQUE NOT NULL,
          name TEXT,
          id_card TEXT,
          blood_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 血袋表
      db.run(`
        CREATE TABLE IF NOT EXISTS blood_bags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bag_code TEXT UNIQUE NOT NULL,
          donor_id INTEGER,
          volume INTEGER DEFAULT 400,
          blood_type TEXT,
          collection_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (donor_id) REFERENCES donors (id)
        )
      `);

      // 样本管表
      db.run(`
        CREATE TABLE IF NOT EXISTS sample_tubes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tube_code TEXT UNIQUE NOT NULL,
          donor_id INTEGER,
          tube_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (donor_id) REFERENCES donors (id)
        )
      `);

      // 血袋-样本管配对表
      db.run(`
        CREATE TABLE IF NOT EXISTS bag_tube_matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          blood_bag_id INTEGER,
          sample_tube_id INTEGER,
          matched_by TEXT,
          matched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'pending',
          FOREIGN KEY (blood_bag_id) REFERENCES blood_bags (id),
          FOREIGN KEY (sample_tube_id) REFERENCES sample_tubes (id)
        )
      `);

      // 冷箱表
      db.run(`
        CREATE TABLE IF NOT EXISTS cold_boxes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          box_code TEXT UNIQUE NOT NULL,
          description TEXT,
          max_temp REAL DEFAULT 10,
          current_temp REAL,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 冷箱时间线表
      db.run(`
        CREATE TABLE IF NOT EXISTS cold_box_timeline (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          box_id INTEGER,
          event_type TEXT NOT NULL,
          temperature REAL,
          blood_bag_code TEXT,
          operator TEXT,
          event_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          FOREIGN KEY (box_id) REFERENCES cold_boxes (id)
        )
      `);

      // 交接记录表
      db.run(`
        CREATE TABLE IF NOT EXISTS handovers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          handover_code TEXT UNIQUE NOT NULL,
          from_operator TEXT NOT NULL,
          to_operator TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          handover_time DATETIME,
          completed_at DATETIME,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 交接明细
      db.run(`
        CREATE TABLE IF NOT EXISTS handover_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          handover_id INTEGER,
          blood_bag_id INTEGER,
          sample_tube_id INTEGER,
          donor_code TEXT,
          status TEXT DEFAULT 'pending',
          check_result TEXT,
          exception_reason TEXT,
          FOREIGN KEY (handover_id) REFERENCES handovers (id),
          FOREIGN KEY (blood_bag_id) REFERENCES blood_bags (id),
          FOREIGN KEY (sample_tube_id) REFERENCES sample_tubes (id)
        )
      `);

      // 审计日志表
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation_type TEXT NOT NULL,
          table_name TEXT,
          record_id INTEGER,
          operator TEXT,
          operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          old_value TEXT,
          new_value TEXT,
          ip_address TEXT,
          notes TEXT
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

module.exports = { initializeDatabase };
