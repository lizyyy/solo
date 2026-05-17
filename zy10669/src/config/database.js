const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      member_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      id_card TEXT,
      data_expiry_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS diseases (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS benefit_packages (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      validity_days INTEGER NOT NULL DEFAULT 365,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS renewal_records (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      disease_id TEXT NOT NULL,
      benefit_package_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      materials TEXT,
      source_system TEXT NOT NULL,
      operator TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (disease_id) REFERENCES diseases(id),
      FOREIGN KEY (benefit_package_id) REFERENCES benefit_packages(id),
      UNIQUE(member_id, disease_id, benefit_package_id, status)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS renewal_history (
      id TEXT PRIMARY KEY,
      renewal_record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      source_system TEXT NOT NULL,
      operator TEXT NOT NULL,
      change_content TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (renewal_record_id) REFERENCES renewal_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS import_bad_records (
      id TEXT PRIMARY KEY,
      import_batch_no TEXT NOT NULL,
      row_data TEXT NOT NULL,
      error_message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
  });
}

module.exports = db;