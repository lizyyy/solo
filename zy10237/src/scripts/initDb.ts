import { run } from '../db/database';

async function initDatabase() {
  console.log('开始初始化数据库...');

  await run(`
    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY,
      consultation_no TEXT UNIQUE NOT NULL,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      status TEXT NOT NULL,
      amount REAL DEFAULT 0,
      paid_at TEXT,
      payment_no TEXT,
      logistics_no TEXT,
      logistics_company TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      prescription_no TEXT UNIQUE NOT NULL,
      consultation_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      pharmacist_id TEXT,
      pharmacist_name TEXT,
      status TEXT NOT NULL,
      reject_reason TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (consultation_id) REFERENCES consultations(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS prescription_items (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      specification TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      dosage TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS status_logs (
      id TEXT PRIMARY KEY,
      business_type TEXT NOT NULL,
      business_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      remark TEXT,
      idempotent_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_consultation_no ON consultations(consultation_no)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_prescription_consultation ON prescriptions(consultation_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_status_logs_business ON status_logs(business_type, business_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_status_logs_idempotent ON status_logs(idempotent_key)`);

  console.log('数据库初始化完成！');
}

initDatabase().catch(console.error);
