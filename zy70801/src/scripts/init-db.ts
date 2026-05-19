import fs from 'fs';
import path from 'path';
import db from '../db';

const dataDir = path.join(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const initTables = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        batch_no TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        record_count INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        processed_at TEXT
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS critical_values (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        test_item TEXT NOT NULL,
        test_value TEXT NOT NULL,
        unit TEXT,
        reference_range TEXT,
        test_time TEXT NOT NULL,
        report_time TEXT,
        department TEXT,
        ward TEXT,
        bed_no TEXT,
        status TEXT NOT NULL,
        failure_reason TEXT,
        suggestion TEXT,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS callback_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        critical_value_id TEXT,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        callback_time TEXT NOT NULL,
        callback_person TEXT NOT NULL,
        callback_phone TEXT,
        receiver TEXT NOT NULL,
        receiver_phone TEXT,
        callback_content TEXT,
        callback_result TEXT NOT NULL,
        failure_reason TEXT,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (critical_value_id) REFERENCES critical_values(id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS duty_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        date TEXT NOT NULL,
        shift TEXT NOT NULL,
        department TEXT NOT NULL,
        doctor_name TEXT NOT NULL,
        doctor_phone TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        is_on_duty INTEGER DEFAULT 1,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS confirm_records (
        id TEXT PRIMARY KEY,
        critical_value_id TEXT NOT NULL,
        confirm_time TEXT NOT NULL,
        confirmer TEXT NOT NULL,
        confirmer_phone TEXT,
        confirm_result TEXT NOT NULL,
        confirm_note TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (critical_value_id) REFERENCES critical_values(id)
      )
    `);

    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_critical_patient ON critical_values(patient_id, test_time)
    `);

    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_batch_hash ON batches(file_hash)
    `);

    console.log('数据库表初始化成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
};

initTables().then(() => {
  db.close();
  process.exit(0);
}).catch((error) => {
  console.error(error);
  db.close();
  process.exit(1);
});
