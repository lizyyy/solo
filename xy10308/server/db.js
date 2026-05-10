const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
const dbPath = path.join(__dirname, '..', 'data', 'studio.db');

async function initDatabase() {
  const SQL = await initSqlJs();
  
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS photographers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      specialty TEXT,
      is_active INTEGER DEFAULT 1
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      shoot_date TEXT NOT NULL,
      shoot_location TEXT,
      photographer_id INTEGER,
      package_name TEXT,
      base_photos INTEGER DEFAULT 0,
      base_price REAL DEFAULT 0,
      additional_price_per_photo REAL DEFAULT 0,
      priority INTEGER DEFAULT 0,
      is_urgent INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending_selection',
      total_additional_photos INTEGER DEFAULT 0,
      total_additional_price REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      selected_count INTEGER DEFAULT 0,
      editor_id INTEGER,
      scheduled_date TEXT,
      delivery_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      photo_no TEXT NOT NULL,
      is_selected INTEGER DEFAULT 0,
      is_additional INTEGER DEFAULT 0,
      selected_at TEXT,
      UNIQUE(order_id, photo_no)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS editors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      skill_level TEXT,
      is_active INTEGER DEFAULT 1
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS schedule_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      editor_id INTEGER,
      scheduled_date TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      reminder_type TEXT NOT NULL,
      reminder_text TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS history_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      field_changed TEXT,
      old_value TEXT,
      new_value TEXT,
      operator TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      details TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS delivery_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      delivery_date TEXT NOT NULL,
      delivered_by TEXT,
      delivery_method TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  saveDatabase();
  return db;
}

function seedData() {
  const photographers = db.exec('SELECT COUNT(*) as count FROM photographers');
  const photographersCount = photographers.length > 0 && photographers[0].values.length > 0 ? photographers[0].values[0][0] : 0;
  
  if (photographersCount === 0) {
    db.run('INSERT INTO photographers (name, specialty) VALUES (?, ?)', ['张摄影', '亲子/儿童']);
    db.run('INSERT INTO photographers (name, specialty) VALUES (?, ?)', ['李摄影', '亲子/家庭']);
    db.run('INSERT INTO photographers (name, specialty) VALUES (?, ?)', ['王摄影', '新生儿']);
  }
  
  const editors = db.exec('SELECT COUNT(*) as count FROM editors');
  const editorsCount = editors.length > 0 && editors[0].values.length > 0 ? editors[0].values[0][0] : 0;
  
  if (editorsCount === 0) {
    db.run('INSERT INTO editors (name, skill_level) VALUES (?, ?)', ['刘修图', '高级']);
    db.run('INSERT INTO editors (name, skill_level) VALUES (?, ?)', ['陈修图', '中级']);
    db.run('INSERT INTO editors (name, skill_level) VALUES (?, ?)', ['周修图', '初级']);
  }
  
  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getRows(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

function getOne(result) {
  const rows = getRows(result);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  initDatabase,
  seedData,
  saveDatabase,
  getRows,
  getOne,
  getDb: () => db
};
