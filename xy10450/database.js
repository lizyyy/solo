const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db;

const dbPath = path.join(__dirname, 'decoration.db');

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS material_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS material_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      spec TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL,
      budget_unit_price REAL,
      delivery_deadline TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (category_id) REFERENCES material_categories(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_item_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      quote_date TEXT NOT NULL,
      unit_price REAL NOT NULL,
      unit TEXT NOT NULL,
      tax_rate REAL DEFAULT 0,
      delivery_days INTEGER,
      spec TEXT NOT NULL,
      brand TEXT,
      is_alternative INTEGER DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_item_id) REFERENCES material_items(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_item_id INTEGER NOT NULL UNIQUE,
      quote_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      selected_by TEXT,
      selected_at DATETIME,
      approved_by TEXT,
      approved_at DATETIME,
      approval_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_item_id) REFERENCES material_items(id),
      FOREIGN KEY (quote_id) REFERENCES quotes(id)
    );

    CREATE TABLE IF NOT EXISTS approval_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      selection_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      actor TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (selection_id) REFERENCES supplier_selections(id)
    );

    CREATE TABLE IF NOT EXISTS unit_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      from_unit TEXT NOT NULL,
      to_unit TEXT NOT NULL,
      factor REAL NOT NULL,
      FOREIGN KEY (category_id) REFERENCES material_categories(id)
    );
  `);

  const catCount = db.exec('SELECT COUNT(*) as cnt FROM material_categories')[0].values[0][0];
  if (catCount === 0) {
    db.run('INSERT INTO material_categories (name, unit) VALUES (?, ?)', ['瓷砖', '片']);
    db.run('INSERT INTO material_categories (name, unit) VALUES (?, ?)', ['板材', '张']);
    db.run('INSERT INTO material_categories (name, unit) VALUES (?, ?)', ['五金', '个']);
  }

  const unitCount = db.exec('SELECT COUNT(*) as cnt FROM unit_conversions')[0].values[0][0];
  if (unitCount === 0) {
    const tileCatRes = db.exec("SELECT id FROM material_categories WHERE name = '瓷砖'");
    if (tileCatRes.length > 0 && tileCatRes[0].values.length > 0) {
      const tileCatId = tileCatRes[0].values[0][0];
      db.run('INSERT INTO unit_conversions (category_id, from_unit, to_unit, factor) VALUES (?, ?, ?, ?)', [tileCatId, '箱', '片', 8]);
      db.run('INSERT INTO unit_conversions (category_id, from_unit, to_unit, factor) VALUES (?, ?, ?, ?)', [tileCatId, '平米', '片', 2.78]);
    }
  }

  saveDb();
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  const changes = db.getRowsModified();
  saveDb();
  return { lastInsertRowid: lastId, changes };
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const result = {};
    cols.forEach((col, i) => {
      result[col] = vals[i];
    });
    return result;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  let cols = null;
  while (stmt.step()) {
    if (!cols) cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((col, i) => {
      row[col] = vals[i];
    });
    results.push(row);
  }
  stmt.free();
  return results;
}

function prepare(sql) {
  return {
    run: function(...params) {
      return run(sql, params);
    },
    get: function(...params) {
      return get(sql, params);
    },
    all: function(...params) {
      return all(sql, params);
    }
  };
}

module.exports = {
  initDatabase,
  run,
  get,
  all,
  prepare,
  saveDb,
  exec: (sql) => {
    db.run(sql);
    saveDb();
  }
};
