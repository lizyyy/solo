import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'pharmacy.db');

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      generic_name TEXT,
      manufacturer TEXT,
      specification TEXT,
      unit TEXT NOT NULL,
      dosage_form TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inventory_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      manufacture_date DATE,
      expiry_date DATE,
      location TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS dosage_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      species TEXT NOT NULL,
      min_weight REAL,
      max_weight REAL,
      min_dosage REAL NOT NULL,
      max_dosage REAL NOT NULL,
      dosage_unit TEXT NOT NULL,
      dosage_per_kg REAL,
      frequency TEXT,
      route TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_no TEXT UNIQUE NOT NULL,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      weight REAL NOT NULL,
      weight_unit TEXT DEFAULT 'kg',
      age TEXT,
      doctor_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      diagnosis TEXT,
      status TEXT DEFAULT 'pending',
      total_amount REAL,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      batch_id INTEGER,
      dosage REAL NOT NULL,
      dosage_unit TEXT NOT NULL,
      quantity REAL NOT NULL,
      quantity_unit TEXT NOT NULL,
      frequency TEXT,
      route TEXT,
      days INTEGER,
      notes TEXT,
      calculated_dosage REAL,
      dosage_warning TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id),
      FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bad_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_file TEXT,
      row_number INTEGER,
      original_data TEXT NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      suggestion TEXT,
      status TEXT DEFAULT 'pending',
      corrected_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator_id TEXT,
      operator_name TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      prescription_item_id INTEGER,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      reference_no TEXT,
      notes TEXT,
      operator_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES inventory_batches(id),
      FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id)
    )`);

    console.log('数据库表初始化完成');
  });
}

export const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const allQuery = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};
