const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
const dbPath = path.join(dbDir, 'maintenance.db');

let db = null;

const saveDb = () => {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const loadDb = async () => {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    initTables();
    saveDb();
  }
};

const initTables = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      asset_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      installation_date TEXT NOT NULL,
      warranty_start_date TEXT NOT NULL,
      warranty_end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      manufacturer TEXT,
      model TEXT,
      vendor_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      service_area TEXT,
      rating REAL DEFAULT 5.0,
      total_orders INTEGER DEFAULT 0,
      completed_orders INTEGER DEFAULT 0,
      average_response_time INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      asset_id TEXT NOT NULL,
      vendor_id TEXT,
      reporter_id TEXT NOT NULL,
      reporter_name TEXT,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'submitted',
      warranty_status TEXT,
      fault_type TEXT,
      parent_order_id TEXT,
      merged_orders TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      due_at TEXT,
      escalated_at TEXT,
      completed_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      vendor_id TEXT NOT NULL,
      labor_cost REAL DEFAULT 0,
      parts_cost REAL DEFAULT 0,
      other_cost REAL DEFAULT 0,
      total_cost REAL NOT NULL,
      estimated_time INTEGER,
      quote_note TEXT,
      approval_status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      rejected_by TEXT,
      rejected_at TEXT,
      reject_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      quote_id TEXT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payer TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      actor TEXT NOT NULL,
      actor_role TEXT,
      details TEXT,
      diff TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL,
      rating INTEGER NOT NULL,
      response_time_rating INTEGER,
      quality_rating INTEGER,
      price_rating INTEGER,
      comment TEXT,
      evaluator TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS callbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      callback_id TEXT UNIQUE NOT NULL,
      order_id TEXT,
      action TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      result TEXT,
      executed_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS system_configs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const configCheck = db.exec('SELECT COUNT(*) as count FROM system_configs');
  const configCount = configCheck.length > 0 && configCheck[0].values.length > 0 
    ? configCheck[0].values[0][0] 
    : 0;
  
  if (configCount === 0) {
    const now = new Date().toISOString();
    db.run('INSERT INTO system_configs (key, value, updated_at) VALUES (?, ?, ?)', 
      ['quote_threshold', '5000', now]);
    db.run('INSERT INTO system_configs (key, value, updated_at) VALUES (?, ?, ?)', 
      ['escalation_hours', '4', now]);
    db.run('INSERT INTO system_configs (key, value, updated_at) VALUES (?, ?, ?)', 
      ['response_sla_hours', '2', now]);
    db.run('INSERT INTO system_configs (key, value, updated_at) VALUES (?, ?, ?)', 
      ['merge_same_asset_hours', '24', now]);
  }
};

const prepare = (sql) => {
  return {
    run: (...params) => {
      db.run(sql, params);
      saveDb();
      return {
        lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0],
        changes: db.getRowsModified()
      };
    },
    get: (...params) => {
      const results = db.exec(sql, params);
      if (results.length === 0 || results[0].values.length === 0) {
        return undefined;
      }
      const columns = results[0].columns;
      const values = results[0].values[0];
      const row = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      return row;
    },
    all: (...params) => {
      const results = db.exec(sql, params);
      if (results.length === 0) {
        return [];
      }
      const columns = results[0].columns;
      return results[0].values.map(values => {
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        return row;
      });
    }
  };
};

const exec = (sql) => {
  db.exec(sql);
  saveDb();
};

const pragma = (statement) => {
};

module.exports = {
  loadDb,
  prepare,
  exec,
  pragma,
  saveDb
};
