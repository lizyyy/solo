const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dbDir, 'live_stream.db');

let db = null;
let SQL = null;

const saveDb = () => {
  if (!db || !dbDir) return;
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const loadDb = () => {
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    return new SQL.Database(fileBuffer);
  }
  return null;
};

const getLastInsertRowId = () => {
  const result = db.exec('SELECT last_insert_rowid() as id');
  if (result && result[0] && result[0].values && result[0].values[0]) {
    return result[0].values[0][0];
  }
  return 0;
};

const init = async () => {
  SQL = await initSqlJs();
  
  const existingDb = loadDb();
  if (existingDb) {
    db = existingDb;
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      streamer_id TEXT NOT NULL,
      streamer_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      status TEXT DEFAULT 'active'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (stream_id) REFERENCES streams(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      min_amount REAL DEFAULT 0,
      stock INTEGER DEFAULT -1,
      is_mutual_exclusive INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stream_id) REFERENCES streams(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS full_reductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      threshold_amount REAL NOT NULL,
      discount_amount REAL NOT NULL,
      priority INTEGER DEFAULT 1,
      FOREIGN KEY (stream_id) REFERENCES streams(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS gifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      threshold_amount REAL NOT NULL,
      gift_product_id INTEGER NOT NULL,
      gift_quantity INTEGER NOT NULL DEFAULT 1,
      stock INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (stream_id) REFERENCES streams(id),
      FOREIGN KEY (gift_product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      stream_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      total_amount REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      pay_amount REAL NOT NULL,
      status TEXT DEFAULT 'paid',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stream_id) REFERENCES streams(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      pay_amount REAL NOT NULL,
      refund_quantity INTEGER DEFAULT 0,
      refund_amount REAL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      promotion_type TEXT NOT NULL,
      promotion_id INTEGER NOT NULL,
      discount_amount REAL NOT NULL,
      is_refunded INTEGER DEFAULT 0,
      refund_time TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_gifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      gift_rule_id INTEGER NOT NULL,
      gift_product_id INTEGER NOT NULL,
      gift_quantity INTEGER NOT NULL,
      is_refunded INTEGER DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (gift_rule_id) REFERENCES gifts(id),
      FOREIGN KEY (gift_product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS coupon_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id INTEGER NOT NULL,
      order_id INTEGER,
      user_id TEXT NOT NULL,
      used_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'used',
      FOREIGN KEY (coupon_id) REFERENCES coupons(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  saveDb();
};

const normalizeParams = (params) => {
  return params.map(p => p === null || p === undefined ? null : p);
};

const prepare = (sql) => {
  return {
    run: (...params) => {
      const normalizedParams = normalizeParams(params);
      const stmt = db.prepare(sql);
      if (normalizedParams.length > 0) {
        stmt.bind(normalizedParams);
      }
      stmt.step();
      stmt.free();
      
      const lastInsertRowid = getLastInsertRowId();
      
      saveDb();
      
      return {
        lastInsertRowid: lastInsertRowid,
        changes: db.getRowsModified()
      };
    },
    get: (...params) => {
      const normalizedParams = normalizeParams(params);
      const stmt = db.prepare(sql);
      if (normalizedParams.length > 0) {
        stmt.bind(normalizedParams);
      }
      let result = null;
      if (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        result = {};
        columns.forEach((col, i) => {
          result[col] = values[i];
        });
      }
      stmt.free();
      return result;
    },
    all: (...params) => {
      const normalizedParams = normalizeParams(params);
      const results = [];
      const stmt = db.prepare(sql);
      if (normalizedParams.length > 0) {
        stmt.bind(normalizedParams);
      }
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const values = stmt.get();
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        results.push(row);
      }
      stmt.free();
      return results;
    }
  };
};

const exec = (sql) => {
  db.run(sql);
  saveDb();
};

const transaction = (fn) => {
  return (...args) => {
    try {
      db.run('BEGIN TRANSACTION');
      const result = fn(...args);
      db.run('COMMIT');
      saveDb();
      return result;
    } catch (error) {
      try {
        db.run('ROLLBACK');
      } catch (e) {}
      throw error;
    }
  };
};

module.exports = {
  init,
  prepare,
  exec,
  transaction
};
