const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'print_queue.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_no TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        page_count INTEGER NOT NULL,
        paper_size TEXT NOT NULL,
        binding_type TEXT NOT NULL,
        device_queue TEXT NOT NULL,
        pickup_promise TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        rework_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        operator TEXT DEFAULT 'system',
        created_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        order_id TEXT,
        created_at TEXT NOT NULL
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_device_queue ON orders(device_queue)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_timeline_order_id ON timeline(order_id)`);

      resolve();
    });
  });
};

const closeDatabase = () => {
  db.close();
};

module.exports = { db, initDatabase, closeDatabase };
