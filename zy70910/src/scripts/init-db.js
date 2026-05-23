require('dotenv').config();
const db = require('../config/database');

const createTables = () => {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = OFF');

    db.run('DROP TABLE IF EXISTS review_logs');
    db.run('DROP TABLE IF EXISTS discrepancies');
    db.run('DROP TABLE IF EXISTS reports');
    db.run('DROP TABLE IF EXISTS reconciliation_tasks');
    db.run('DROP TABLE IF EXISTS payment_records');
    db.run('DROP TABLE IF EXISTS charger_logs');
    db.run('DROP TABLE IF EXISTS orders');

    db.run("CREATE TABLE orders (order_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, charger_id TEXT NOT NULL, start_time DATETIME NOT NULL, end_time DATETIME, charge_amount REAL, amount REAL, status TEXT NOT NULL, platform_source TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");

    db.run('CREATE INDEX idx_orders_user_id ON orders(user_id)');
    db.run('CREATE INDEX idx_orders_charger_id ON orders(charger_id)');
    db.run('CREATE INDEX idx_orders_start_time ON orders(start_time)');
    db.run('CREATE INDEX idx_orders_status ON orders(status)');
    db.run('CREATE INDEX idx_orders_platform ON orders(platform_source)');

    db.run("CREATE TABLE charger_logs (log_id TEXT PRIMARY KEY, charger_id TEXT NOT NULL, order_id TEXT, event_time DATETIME NOT NULL, realtime_charge REAL, status TEXT, event_type TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL)");

    db.run('CREATE INDEX idx_charger_logs_charger_id ON charger_logs(charger_id)');
    db.run('CREATE INDEX idx_charger_logs_order_id ON charger_logs(order_id)');
    db.run('CREATE INDEX idx_charger_logs_event_time ON charger_logs(event_time)');
    db.run('CREATE INDEX idx_charger_logs_event_type ON charger_logs(event_type)');
  });
};

createTables();
