const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      requires_review INTEGER NOT NULL DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS application (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apply_no TEXT UNIQUE NOT NULL,
      owner_name TEXT NOT NULL,
      room_no TEXT NOT NULL,
      deposit_amount REAL NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS inspection (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apply_no TEXT NOT NULL,
      seq INTEGER NOT NULL,
      inspector TEXT,
      inspect_date TEXT,
      rule_code TEXT NOT NULL,
      detail TEXT,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS batch (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS record (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      apply_no TEXT NOT NULL,
      owner_name TEXT,
      room_no TEXT,
      deposit_amount REAL DEFAULT 0,

      review_status TEXT NOT NULL DEFAULT 'pending',
      review_note TEXT,

      freeze_amount REAL DEFAULT 0,
      freeze_note TEXT,

      refund_status TEXT NOT NULL DEFAULT 'pending',
      refund_amount REAL DEFAULT 0,
      refund_note TEXT,

      raw_violations TEXT,
      diff_explanation TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),

      FOREIGN KEY(batch_id) REFERENCES batch(id)
    );

    CREATE TABLE IF NOT EXISTS record_review_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT,
      at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(record_id) REFERENCES record(id)
    );

    CREATE INDEX IF NOT EXISTS idx_record_batch ON record(batch_id);
    CREATE INDEX IF NOT EXISTS idx_record_apply ON record(apply_no);
    CREATE INDEX IF NOT EXISTS idx_inspection_apply ON inspection(apply_no);
  `);

  const ruleCount = db.prepare('SELECT COUNT(*) c FROM rule').get().c;
  if (ruleCount === 0) {
    const ins = db.prepare(
      'INSERT INTO rule(code,name,category,amount,requires_review,description) VALUES (?,?,?,?,?,?)'
    );
    ins.run('R01', '拆改承重墙', '结构违规', 5000, 1, '破坏承重结构，必须整改复验通过');
    ins.run('R02', '违规封阳台', '外观违规', 1000, 0, '未经审批封闭阳台');
    ins.run('R03', '私接水管', '水电违规', 800, 1, '私改给排水，需复验');
    ins.run('R04', '噪音扰民投诉', '行为违规', 300, 0, '施工扰民被投诉');
    ins.run('R05', '消防设施遮挡', '安全违规', 1500, 1, '遮挡消防栓/喷淋');
    ins.run('R06', '公共区域占用', '秩序违规', 600, 0, '堆放建材占用公共区域');
  }
}

function getDb() { return db; }

module.exports = { init, getDb };
