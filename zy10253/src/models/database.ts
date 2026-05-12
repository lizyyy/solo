import db from '../config/database';

export const initDatabase = () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS contracts (
          id TEXT PRIMARY KEY,
          contract_no TEXT UNIQUE NOT NULL,
          student_id TEXT NOT NULL,
          student_name TEXT NOT NULL,
          campus_id TEXT NOT NULL,
          campus_name TEXT NOT NULL,
          course_name TEXT NOT NULL,
          total_lessons INTEGER NOT NULL,
          paid_lessons INTEGER NOT NULL,
          gifted_lessons INTEGER NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          material_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          installment_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          unit_price DECIMAL(10,2) NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          signed_date TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS schedules (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          lesson_date TEXT NOT NULL,
          lesson_time TEXT NOT NULL,
          teacher_id TEXT NOT NULL,
          teacher_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'scheduled',
          is_gifted INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES contracts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS attendances (
          id TEXT PRIMARY KEY,
          schedule_id TEXT NOT NULL,
          contract_id TEXT NOT NULL,
          attended_date TEXT NOT NULL,
          is_gifted INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (schedule_id) REFERENCES schedules(id),
          FOREIGN KEY (contract_id) REFERENCES contracts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS installments (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          installment_no INTEGER NOT NULL,
          due_date TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          principal DECIMAL(10,2) NOT NULL,
          fee DECIMAL(10,2) NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          paid_date TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES contracts(id),
          UNIQUE(contract_id, installment_no)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS refund_applications (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          application_no TEXT UNIQUE NOT NULL,
          reason TEXT NOT NULL,
          requested_date TEXT NOT NULL,
          total_refund_amount DECIMAL(10,2) NOT NULL,
          actual_refund_amount DECIMAL(10,2) NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES contracts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS refund_items (
          id TEXT PRIMARY KEY,
          refund_id TEXT NOT NULL,
          item_type TEXT NOT NULL,
          item_name TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10,2),
          remark TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (refund_id) REFERENCES refund_applications(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS approval_history (
          id TEXT PRIMARY KEY,
          refund_id TEXT NOT NULL,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          approver_id TEXT NOT NULL,
          approver_name TEXT NOT NULL,
          comment TEXT,
          previous_status TEXT,
          new_status TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (refund_id) REFERENCES refund_applications(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS business_history (
          id TEXT PRIMARY KEY,
          business_type TEXT NOT NULL,
          business_id TEXT NOT NULL,
          action TEXT NOT NULL,
          operator_id TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          before_data TEXT,
          after_data TEXT,
          remark TEXT,
          created_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_contracts_student ON contracts(student_id);
        CREATE INDEX IF NOT EXISTS idx_schedules_contract ON schedules(contract_id);
        CREATE INDEX IF NOT EXISTS idx_attendances_contract ON attendances(contract_id);
        CREATE INDEX IF NOT EXISTS idx_installments_contract ON installments(contract_id);
        CREATE INDEX IF NOT EXISTS idx_refund_contract ON refund_applications(contract_id);
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export default db;
