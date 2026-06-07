const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'tour_hotel.db');
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS contract_screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_batch_id TEXT NOT NULL,
      original_row_number INTEGER NOT NULL,
      song_name TEXT NOT NULL,
      song_name_type TEXT DEFAULT 'unknown',
      hotel_name TEXT,
      room_type TEXT,
      room_count INTEGER DEFAULT 0,
      check_in_date TEXT,
      check_out_date TEXT,
      remarks TEXT,
      source_file TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      status TEXT DEFAULT 'imported',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by TEXT DEFAULT 'system',
      UNIQUE(import_batch_id, original_row_number, file_hash)
    );

    CREATE TABLE IF NOT EXISTS song_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL,
      alias_name TEXT NOT NULL,
      alias_type TEXT DEFAULT 'live_name',
      source TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(canonical_name, alias_name)
    );

    CREATE TABLE IF NOT EXISTS room_linkages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_screenshot_id INTEGER NOT NULL,
      song_canonical_name TEXT,
      matched_alias_id INTEGER,
      hotel_name TEXT,
      room_type TEXT,
      room_count INTEGER,
      linkage_status TEXT DEFAULT 'pending',
      conflict_detail TEXT,
      review_note TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS operation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      operation_type TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      operation_note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_screenshot_id INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      step_status TEXT DEFAULT 'pending',
      step_order INTEGER NOT NULL,
      operator TEXT,
      completed_at TEXT,
      step_note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL UNIQUE,
      source_file TEXT NOT NULL,
      total_rows INTEGER DEFAULT 0,
      imported_rows INTEGER DEFAULT 0,
      duplicate_rows INTEGER DEFAULT 0,
      imported_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contract_status ON contract_screenshots(status);
    CREATE INDEX IF NOT EXISTS idx_contract_song ON contract_screenshots(song_name);
    CREATE INDEX IF NOT EXISTS idx_linkage_status ON room_linkages(linkage_status);
    CREATE INDEX IF NOT EXISTS idx_history_entity ON operation_history(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_contract ON workflow_steps(contract_screenshot_id);
  `);
  
  saveDatabase();
  
  return db;
}

function saveDatabase() {
  const dbPath = path.join(__dirname, 'tour_hotel.db');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function prepare(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      saveDatabase();
      const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
      const changes = db.getRowsModified ? db.getRowsModified() : 1;
      return { lastInsertRowid: lastId, changes: changes };
    },
    get: function(...params) {
      const results = db.exec(sql, params);
      if (results.length === 0 || results[0].values.length === 0) return undefined;
      const columns = results[0].columns;
      const values = results[0].values[0];
      const row = {};
      columns.forEach((col, i) => row[col] = values[i]);
      return row;
    },
    all: function(...params) {
      const results = db.exec(sql, params);
      if (results.length === 0) return [];
      const columns = results[0].columns;
      return results[0].values.map(values => {
        const row = {};
        columns.forEach((col, i) => row[col] = values[i]);
        return row;
      });
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDatabase();
}

const WORKFLOW_STEPS = [
  { name: 'contract_import', label: '合同页截图导入', order: 1 },
  { name: 'alias_check', label: '核对曲目别名表', order: 2 },
  { name: 'weekly_report', label: '更新店长周报', order: 3 }
];

module.exports = {
  get db() { return db; },
  initDatabase,
  prepare,
  exec,
  WORKFLOW_STEPS
};
