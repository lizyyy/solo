import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../data/sample-review.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sample_batches (
      id TEXT PRIMARY KEY,
      batch_no TEXT UNIQUE NOT NULL,
      supplier_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      sample_type TEXT,
      quantity INTEGER,
      receive_date DATE,
      status TEXT DEFAULT 'pending',
      version TEXT DEFAULT '1.0',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS review_scores (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      review_date DATE NOT NULL,
      appearance_score INTEGER,
      quality_score INTEGER,
      function_score INTEGER,
      packaging_score INTEGER,
      total_score INTEGER,
      comments TEXT,
      result TEXT,
      version TEXT DEFAULT '1.0',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES sample_batches(id)
    );

    CREATE TABLE IF NOT EXISTS rectification_opinions (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      item TEXT NOT NULL,
      description TEXT,
      requirement TEXT,
      deadline DATE,
      responsible_person TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES sample_batches(id)
    );

    CREATE TABLE IF NOT EXISTS reship_logistics (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      tracking_no TEXT,
      courier_company TEXT,
      ship_date DATE,
      receive_date DATE,
      status TEXT DEFAULT 'transit',
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES sample_batches(id)
    );

    CREATE TABLE IF NOT EXISTS version_finalizations (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      final_version TEXT NOT NULL,
      finalizer TEXT NOT NULL,
      finalize_date DATE NOT NULL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES sample_batches(id)
    );

    CREATE TABLE IF NOT EXISTS change_logs (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export default db;
