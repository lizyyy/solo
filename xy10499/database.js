const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'snack-tasting.db');

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    const buffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      store_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      attribution_window_hours INTEGER NOT NULL DEFAULT 24
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_cost REAL NOT NULL,
      total_quantity INTEGER NOT NULL,
      remaining_quantity INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS distributions (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      distributed_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      distribution_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      receipt_id TEXT NOT NULL,
      purchase_amount REAL NOT NULL,
      purchased_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS waste (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      wasted_at TEXT NOT NULL
    )
  `);

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function getDb() {
  return db;
}

module.exports = {
  initDatabase,
  saveDatabase,
  getDb
};
