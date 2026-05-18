import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'camera_rental.db');
const db = new sqlite3.Database(dbPath);

export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS customers (
          customer_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          id_card TEXT NOT NULL,
          credit_score INTEGER DEFAULT 100,
          total_rentals INTEGER DEFAULT 0,
          overdue_times INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS equipment (
          equipment_id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          brand TEXT NOT NULL,
          model TEXT NOT NULL,
          serial_number TEXT NOT NULL UNIQUE,
          purchase_price REAL NOT NULL,
          daily_rental_price REAL NOT NULL,
          deposit REAL NOT NULL,
          status TEXT DEFAULT 'available',
          condition TEXT DEFAULT 'good',
          last_maintenance_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rental_orders (
          order_id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          rental_start_date DATETIME NOT NULL,
          expected_return_date DATETIME NOT NULL,
          actual_return_date DATETIME,
          total_amount REAL NOT NULL,
          deposit_paid REAL NOT NULL,
          status TEXT DEFAULT 'active',
          pickup_location TEXT NOT NULL,
          return_location TEXT NOT NULL,
          staff_name TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rental_items (
          item_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          equipment_id TEXT NOT NULL,
          daily_price REAL NOT NULL,
          quantity INTEGER DEFAULT 1,
          actual_return_date DATETIME,
          return_condition TEXT,
          return_staff TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES rental_orders(order_id),
          FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS overdue_bills (
          bill_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          overdue_days INTEGER NOT NULL,
          overdue_amount REAL NOT NULL,
          equipment_ids TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          review_status TEXT DEFAULT 'pending',
          review_notes TEXT,
          reviewed_by TEXT,
          reviewed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES rental_orders(order_id),
          FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS damage_reports (
          report_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          equipment_id TEXT NOT NULL,
          damage_type TEXT NOT NULL,
          description TEXT NOT NULL,
          repair_cost REAL,
          reported_by TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES rental_orders(order_id),
          FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
        )
      `);

      resolve();
    });
  });
};

export default db;
