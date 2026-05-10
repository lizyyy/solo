const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'samples.db');

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS dishes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      dish_id TEXT NOT NULL,
      batch_date TEXT NOT NULL,
      meal_time TEXT NOT NULL,
      cook_name TEXT,
      quantity INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(dish_id, batch_date, meal_time),
      FOREIGN KEY (dish_id) REFERENCES dishes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sample_boxes (
      box_no TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'empty',
      current_sample_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sample_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      box_no TEXT NOT NULL,
      sample_time TEXT NOT NULL,
      expire_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      photo_path TEXT,
      operator TEXT NOT NULL,
      remark TEXT,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (box_no) REFERENCES sample_boxes(box_no)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS destruction_records (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      destroy_time TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sample_id) REFERENCES sample_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS supplement_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      sample_id TEXT NOT NULL,
      supplement_reason TEXT NOT NULL,
      supplement_time TEXT NOT NULL,
      operator TEXT NOT NULL,
      original_missing_reason TEXT,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (sample_id) REFERENCES sample_records(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_batches_date ON batches(batch_date)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_samples_status ON sample_records(status)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_samples_expire ON sample_records(expire_time)
  `);

  saveDatabase();
  
  initSampleBoxes();

  return db;
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initSampleBoxes() {
  const result = db.exec('SELECT COUNT(*) as count FROM sample_boxes');
  if (result[0].values[0][0] === 0) {
    for (let i = 1; i <= 50; i++) {
      const boxNo = `BOX${String(i).padStart(3, '0')}`;
      db.run(
        'INSERT INTO sample_boxes (box_no, status, created_at) VALUES (?, ?, ?)',
        [boxNo, 'empty', new Date().toISOString()]
      );
    }
    saveDatabase();
  }
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

function get(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0) return null;
  const columns = result[0].columns;
  const values = result[0].values;
  if (values.length === 0) return null;
  const row = {};
  columns.forEach((col, index) => {
    row[col] = values[0][index];
  });
  return row;
}

function all(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0) return [];
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}

module.exports = {
  initDatabase,
  getDb,
  run,
  get,
  all,
  saveDatabase
};
