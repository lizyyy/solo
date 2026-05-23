const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS storage_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        capacity INTEGER DEFAULT 100,
        current_count INTEGER DEFAULT 0,
        temperature_min REAL DEFAULT -18,
        temperature_max REAL DEFAULT -10,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        dish_name TEXT NOT NULL,
        production_date DATE NOT NULL,
        production_line TEXT,
        chef TEXT,
        quantity INTEGER NOT NULL,
        shelf_life_days INTEGER DEFAULT 48,
        ingredients TEXT,
        supplier TEXT,
        status TEXT DEFAULT 'produced',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sample_boxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        box_no TEXT UNIQUE NOT NULL,
        batch_id INTEGER NOT NULL,
        location_id INTEGER,
        sample_weight REAL,
        sample_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiry_time DATETIME,
        status TEXT DEFAULT 'stored',
        operator TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (location_id) REFERENCES storage_locations(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_box_id INTEGER NOT NULL,
        inspector TEXT NOT NULL,
        inspection_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        temperature REAL,
        appearance TEXT,
        smell TEXT,
        taste TEXT,
        microorganism_result TEXT,
        result TEXT DEFAULT 'pending',
        conclusion TEXT,
        reviewer TEXT,
        review_time DATETIME,
        review_comment TEXT,
        status TEXT DEFAULT 'pending_review',
        compensation_applied BOOLEAN DEFAULT 0,
        compensation_details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sample_box_id) REFERENCES sample_boxes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS destructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_box_id INTEGER NOT NULL,
        destruction_time DATETIME,
        operator TEXT NOT NULL,
        first_operator TEXT,
        witness TEXT,
        destruction_method TEXT,
        reason TEXT,
        cancel_reason TEXT,
        cancelled_by TEXT,
        cancelled_at DATETIME,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sample_box_id) REFERENCES sample_boxes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS trace_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_no TEXT UNIQUE NOT NULL,
        batch_id INTEGER,
        sample_box_id INTEGER,
        report_type TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        content TEXT,
        status TEXT DEFAULT 'generated',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (sample_box_id) REFERENCES sample_boxes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_endpoint TEXT,
        request_method TEXT,
        request_body TEXT,
        request_headers TEXT,
        error_message TEXT,
        error_stack TEXT,
        handling_conclusion TEXT,
        handled_by TEXT,
        handled_at DATETIME,
        status TEXT DEFAULT 'unhandled',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_table TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT NOT NULL,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      resolve();
    });
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  initDatabase,
  runQuery,
  getOne,
  getAll
};
