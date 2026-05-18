const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(config.dbPath);

function runAsync(sql, params) {
  params = params || [];
  return new Promise(function(resolve, reject) {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function getAsync(sql, params) {
  params = params || [];
  return new Promise(function(resolve, reject) {
    db.get(sql, params, function(err, row) {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function allAsync(sql, params) {
  params = params || [];
  return new Promise(function(resolve, reject) {
    db.all(sql, params, function(err, rows) {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function initTables() {
  const tables = [
    "CREATE TABLE IF NOT EXISTS pets (id TEXT PRIMARY KEY, name TEXT NOT NULL, breed TEXT NOT NULL, age INTEGER, owner_id TEXT NOT NULL, owner_name TEXT NOT NULL, owner_phone TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS foster_orders (id TEXT PRIMARY KEY, pet_id TEXT NOT NULL, checkin_date TEXT NOT NULL, checkout_date TEXT NOT NULL, room_number TEXT, original_food_brand TEXT NOT NULL, original_food_type TEXT NOT NULL, original_daily_amount REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS food_inventory (id TEXT PRIMARY KEY, brand TEXT NOT NULL, type TEXT NOT NULL, stock_quantity REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'kg', warning_threshold REAL NOT NULL DEFAULT 5, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(brand, type))",
    "CREATE TABLE IF NOT EXISTS feeding_changes (id TEXT PRIMARY KEY, foster_order_id TEXT NOT NULL, change_type TEXT NOT NULL, change_reason TEXT NOT NULL, original_food_brand TEXT, original_food_type TEXT, original_daily_amount REAL, new_food_brand TEXT, new_food_type TEXT, new_daily_amount REAL, feeding_time_adjustment TEXT, status TEXT NOT NULL, submit_source TEXT NOT NULL, submitted_by TEXT NOT NULL, submitted_at TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT, review_comment TEXT, is_abnormal INTEGER NOT NULL DEFAULT 0, abnormal_reason TEXT, conflict_detected INTEGER NOT NULL DEFAULT 0, conflict_type TEXT, conflict_detail TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS daily_care_reports (id TEXT PRIMARY KEY, foster_order_id TEXT NOT NULL, report_date TEXT NOT NULL, food_brand TEXT NOT NULL, food_type TEXT NOT NULL, food_amount REAL NOT NULL, feeding_time TEXT NOT NULL, appetite_status TEXT NOT NULL, health_status TEXT NOT NULL, notes TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(foster_order_id, report_date))",
    "CREATE TABLE IF NOT EXISTS change_status_logs (id TEXT PRIMARY KEY, feeding_change_id TEXT NOT NULL, from_status TEXT NOT NULL, to_status TEXT NOT NULL, action TEXT NOT NULL, operator TEXT NOT NULL, comment TEXT, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS operators (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT, created_at TEXT NOT NULL)"
  ];

  return Promise.all(tables.map(function(sql) { return runAsync(sql); }));
}

module.exports = {
  db: db,
  initTables: initTables,
  runAsync: runAsync,
  getAsync: getAsync,
  allAsync: allAsync
};
