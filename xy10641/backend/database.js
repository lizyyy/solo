const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'agricultural_credit.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS farmers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        id_card TEXT UNIQUE,
        phone TEXT,
        address TEXT,
        created_at TEXT,
        updated_at TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS credit_applications (
        id TEXT PRIMARY KEY,
        farmer_id TEXT NOT NULL,
        credit_limit REAL NOT NULL,
        used_limit REAL DEFAULT 0,
        status TEXT NOT NULL,
        season TEXT,
        applicant TEXT,
        approver TEXT,
        apply_time TEXT,
        approve_time TEXT,
        remarks TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS credit_audit_logs (
        id TEXT PRIMARY KEY,
        credit_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT,
        operate_time TEXT,
        remarks TEXT,
        FOREIGN KEY (credit_id) REFERENCES credit_applications(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sales_orders (
        id TEXT PRIMARY KEY,
        credit_id TEXT NOT NULL,
        farmer_id TEXT NOT NULL,
        order_no TEXT UNIQUE,
        total_amount REAL NOT NULL,
        products TEXT,
        status TEXT NOT NULL,
        operator TEXT,
        order_time TEXT,
        delivery_time TEXT,
        remarks TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (credit_id) REFERENCES credit_applications(id),
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS order_audit_logs (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT,
        operate_time TEXT,
        remarks TEXT,
        FOREIGN KEY (order_id) REFERENCES sales_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS seasonal_repayments (
        id TEXT PRIMARY KEY,
        credit_id TEXT NOT NULL,
        farmer_id TEXT NOT NULL,
        order_id TEXT,
        season TEXT NOT NULL,
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL,
        overdue_days INTEGER DEFAULT 0,
        overdue_level TEXT,
        operator TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (credit_id) REFERENCES credit_applications(id),
        FOREIGN KEY (farmer_id) REFERENCES farmers(id),
        FOREIGN KEY (order_id) REFERENCES sales_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS repayment_audit_logs (
        id TEXT PRIMARY KEY,
        repayment_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT,
        operate_time TEXT,
        remarks TEXT,
        FOREIGN KEY (repayment_id) REFERENCES seasonal_repayments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS repayment_records (
        id TEXT PRIMARY KEY,
        repayment_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT,
        payment_time TEXT,
        operator TEXT,
        callback_id TEXT UNIQUE,
        remarks TEXT,
        FOREIGN KEY (repayment_id) REFERENCES seasonal_repayments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS extension_applications (
        id TEXT PRIMARY KEY,
        repayment_id TEXT NOT NULL,
        credit_id TEXT NOT NULL,
        farmer_id TEXT NOT NULL,
        original_due_date TEXT NOT NULL,
        new_due_date TEXT NOT NULL,
        extension_days INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL,
        applicant TEXT,
        approver TEXT,
        apply_time TEXT,
        approve_time TEXT,
        remarks TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (repayment_id) REFERENCES seasonal_repayments(id),
        FOREIGN KEY (credit_id) REFERENCES credit_applications(id),
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS collection_lists (
        id TEXT PRIMARY KEY,
        repayment_id TEXT NOT NULL,
        credit_id TEXT NOT NULL,
        farmer_id TEXT NOT NULL,
        collector TEXT,
        collection_level TEXT NOT NULL,
        collection_status TEXT NOT NULL,
        last_collection_time TEXT,
        collection_count INTEGER DEFAULT 0,
        remarks TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (repayment_id) REFERENCES seasonal_repayments(id),
        FOREIGN KEY (credit_id) REFERENCES credit_applications(id),
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_timelines (
        id TEXT PRIMARY KEY,
        related_id TEXT NOT NULL,
        related_type TEXT NOT NULL,
        action TEXT NOT NULL,
        operator TEXT,
        operate_time TEXT,
        details TEXT,
        remarks TEXT
      )`);
    });

    setTimeout(resolve, 100);
  });
};

module.exports = { db, initDatabase };
