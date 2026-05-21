const fs = require('fs');
const content = `const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'store.db');
const db = new sqlite3.Database(dbPath);
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA foreign_keys = ON');
      db.run('CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, location_code TEXT UNIQUE NOT NULL, location_name TEXT NOT NULL, manager TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS sku_mappings (id INTEGER PRIMARY KEY AUTOINCREMENT, sku_code TEXT NOT NULL, sku_name TEXT NOT NULL, alias TEXT, category TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_no TEXT UNIQUE NOT NULL, location_code TEXT NOT NULL, batch_type TEXT NOT NULL, status TEXT DEFAULT "pending", handler TEXT, responsible_person TEXT, remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS inventory_records (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, sku_code TEXT NOT NULL, sku_name TEXT, quantity INTEGER NOT NULL, unit_price REAL, expiry_date DATE, is_near_expiry INTEGER DEFAULT 0, inventory_person TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS sales_records (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, sku_code TEXT NOT NULL, sku_name TEXT, quantity INTEGER NOT NULL, amount REAL NOT NULL, sale_time DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS replenishment_records (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, sku_code TEXT NOT NULL, sku_name TEXT, expected_qty INTEGER NOT NULL, actual_qty INTEGER NOT NULL, difference_type TEXT, unit_price REAL, expiry_date DATE, is_near_expiry INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS processing_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, record_id INTEGER, record_type TEXT, action TEXT NOT NULL, reason TEXT, handler TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS sku_alias_detections (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, detected_alias TEXT NOT NULL, mapped_sku TEXT NOT NULL, record_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}
function run(sql, params) {
  params = params || [];
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function get(sql, params) {
  params = params || [];
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function all(sql, params) {
  params = params || [];
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
module.exports = { db, initDatabase, run, get, all };
`;
fs.writeFileSync('src/database.js', content);
console.log('Written src/database.js');
