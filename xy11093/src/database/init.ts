import { run } from './db';

export async function createTables(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      employee_no TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      is_remote INTEGER NOT NULL DEFAULT 0,
      location TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS training_courses (
      id TEXT PRIMARY KEY,
      course_code TEXT NOT NULL UNIQUE,
      course_name TEXT NOT NULL,
      training_date TEXT NOT NULL,
      training_location TEXT NOT NULL,
      total_seats INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS signin_records (
      id TEXT PRIMARY KEY,
      record_no TEXT NOT NULL UNIQUE,
      employee_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      signin_type TEXT NOT NULL,
      seat_number INTEGER,
      signin_time TEXT NOT NULL,
      status TEXT NOT NULL,
      abnormal_type TEXT,
      business_explanation TEXT NOT NULL,
      submitter_id TEXT NOT NULL,
      submitter_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees (id),
      FOREIGN KEY (course_id) REFERENCES training_courses (id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS signin_history (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES signin_records (id)
    )
  `);

  console.log('数据库表创建完成');
}

export async function dropTables(): Promise<void> {
  await run('DROP TABLE IF EXISTS signin_history');
  await run('DROP TABLE IF EXISTS signin_records');
  await run('DROP TABLE IF EXISTS training_courses');
  await run('DROP TABLE IF EXISTS employees');
  console.log('数据库表删除完成');
}
