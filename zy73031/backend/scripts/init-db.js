const { getDatabase } = require('../config/database');

async function initDatabase() {
  const db = await getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE NOT NULL,
      pet_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      owner_phone TEXT,
      pet_type TEXT,
      pet_breed TEXT,
      pet_gender TEXT,
      pet_age TEXT,
      weight TEXT,
      weight_value REAL,
      weight_unit TEXT,
      visit_date TEXT NOT NULL,
      chief_complaint TEXT,
      diagnosis TEXT,
      handwritten_note TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS training_courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_no TEXT UNIQUE NOT NULL,
      medical_record_id INTEGER,
      course_name TEXT NOT NULL,
      trainer TEXT,
      course_date TEXT NOT NULL,
      course_content TEXT,
      pet_response TEXT,
      home_work TEXT,
      next_plan TEXT,
      conclusion TEXT,
      handwritten_note TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS anomaly_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_no TEXT UNIQUE NOT NULL,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      anomaly_type TEXT NOT NULL,
      anomaly_level TEXT NOT NULL,
      anomaly_field TEXT,
      original_value TEXT,
      normalized_value TEXT,
      description TEXT NOT NULL,
      judgment_change TEXT,
      detected_at TEXT DEFAULT (datetime('now', 'localtime')),
      algorithm_version TEXT DEFAULT 'v1.1',
      口径版本 TEXT DEFAULT '2026-06-v1',
      口径说明 TEXT DEFAULT '体重单位混写判定：体重字段和与体重相关的手写备注中kg/g/lb/斤混用，或数值与单位量级明显不匹配；回访结论空值或歧义；病历单号与训练课关联断裂'
    );

    CREATE TABLE IF NOT EXISTS review_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anomaly_alert_id INTEGER NOT NULL,
      review_status TEXT NOT NULL,
      reviewer TEXT,
      review_note TEXT,
      supplementary_material TEXT,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS public_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medical_record_id INTEGER NOT NULL,
      note_content TEXT NOT NULL,
      note_type TEXT DEFAULT 'community_disclosure',
      created_by TEXT DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  console.log('数据库初始化完成');
  return db;
}

if (require.main === module) {
  initDatabase().catch(e => { console.error(e); process.exit(1); });
}

module.exports = initDatabase;
