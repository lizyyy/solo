const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'linen.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          building TEXT,
          floor INTEGER,
          safe_stock INTEGER DEFAULT 5,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS linens (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          barcode TEXT UNIQUE,
          status TEXT DEFAULT 'in_stock',
          room_id TEXT,
          wash_count INTEGER DEFAULT 0,
          price REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id TEXT PRIMARY KEY,
          batch_no TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'pending',
          send_quantity INTEGER DEFAULT 0,
          receive_quantity INTEGER DEFAULT 0,
          send_at DATETIME,
          receive_at DATETIME,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS batch_items (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          linen_id TEXT NOT NULL,
          linen_type TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          room_id TEXT,
          FOREIGN KEY (batch_id) REFERENCES batches(id),
          FOREIGN KEY (linen_id) REFERENCES linens(id),
          UNIQUE(batch_id, linen_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS claims (
          id TEXT PRIMARY KEY,
          linen_id TEXT NOT NULL,
          batch_id TEXT,
          amount REAL NOT NULL,
          reason TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (linen_id) REFERENCES linens(id),
          FOREIGN KEY (batch_id) REFERENCES batches(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS batch_timeline (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          action TEXT NOT NULL,
          description TEXT,
          quantity INTEGER,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (batch_id) REFERENCES batches(id)
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_linens_status ON linens(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_linens_room ON linens(room_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON batch_items(batch_id)`);

      resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  initDatabase,
  runQuery,
  getQuery,
  allQuery
};
