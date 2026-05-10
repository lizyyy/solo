const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

const dbFilePath = path.join(dbPath, 'kindergarten.db');

let db = null;

async function getDb() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  }
}

async function initDatabase() {
  const database = await getDb();
  
  database.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      monthly_tuition REAL NOT NULL DEFAULT 0,
      daily_meal_fee REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT,
      birthday TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      class_id INTEGER,
      enrollment_date TEXT,
      withdrawal_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      billing_year INTEGER NOT NULL,
      billing_month INTEGER NOT NULL,
      days_in_month INTEGER NOT NULL,
      attendance_days INTEGER NOT NULL DEFAULT 0,
      leave_days INTEGER NOT NULL DEFAULT 0,
      is_mid_month_transfer INTEGER DEFAULT 0,
      transfer_start_date TEXT,
      transfer_end_date TEXT,
      transfer_days INTEGER DEFAULT 0,
      base_tuition REAL NOT NULL DEFAULT 0,
      base_meal_fee REAL NOT NULL DEFAULT 0,
      leave_deduction REAL NOT NULL DEFAULT 0,
      transfer_adjustment REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      formula TEXT,
      notes TEXT,
      is_manual_modified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      UNIQUE(student_id, billing_year, billing_month)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS bill_modifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT NOT NULL,
      before_data TEXT NOT NULL,
      after_data TEXT NOT NULL,
      affected_fields TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
      operator TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS leave_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS reduction_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      bill_id INTEGER,
      reduction_type TEXT NOT NULL,
      reduction_amount REAL NOT NULL,
      reason TEXT NOT NULL,
      applied_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id)
    )
  `);

  saveDb();
}

async function seedSampleData() {
  const database = await getDb();
  
  const classCount = database.exec('SELECT COUNT(*) as count FROM classes')[0]?.values[0]?.[0] || 0;
  if (classCount > 0) return;

  database.run(`
    INSERT INTO classes (name, level, monthly_tuition, daily_meal_fee)
    VALUES ('小一班', '小班', 2000, 25)
  `);
  const class1Id = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  database.run(`
    INSERT INTO classes (name, level, monthly_tuition, daily_meal_fee)
    VALUES ('中一班', '中班', 2500, 30)
  `);
  const class2Id = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  database.run(`
    INSERT INTO classes (name, level, monthly_tuition, daily_meal_fee)
    VALUES ('大一班', '大班', 3000, 35)
  `);
  const class3Id = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  database.run(`
    INSERT INTO students (name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, status)
    VALUES ('张小明', '男', '2021-03-15', '张父', '13800138001', ${class1Id}, '2024-09-01', 'active')
  `);

  database.run(`
    INSERT INTO students (name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, status)
    VALUES ('李小红', '女', '2021-05-20', '李母', '13800138002', ${class1Id}, '2024-09-01', 'active')
  `);
  const s2Id = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  database.run(`
    INSERT INTO students (name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, status)
    VALUES ('王小强', '男', '2020-08-10', '王父', '13800138003', ${class2Id}, '2024-09-01', 'active')
  `);
  const s3Id = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  database.run(`
    INSERT INTO students (name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, status)
    VALUES ('刘小娟', '女', '2020-12-05', '刘母', '13800138004', ${class2Id}, '2024-09-01', 'active')
  `);

  database.run(`
    INSERT INTO students (name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, status)
    VALUES ('陈大龙', '男', '2020-02-18', '陈父', '13800138005', ${class3Id}, '2024-09-01', 'active')
  `);
  const s5Id = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  database.run(`
    INSERT INTO students (name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, status)
    VALUES ('周小美', '女', '2019-11-22', '周母', '13800138006', ${class3Id}, '2024-09-01', 'withdrawn')
  `);
  const s6Id = database.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  database.run(`
    UPDATE students SET withdrawal_date = '2024-12-15' WHERE id = ${s6Id}
  `);

  database.run(`
    INSERT INTO leave_records (student_id, leave_type, start_date, end_date, days, reason, status)
    VALUES (${s2Id}, '事假', '2024-12-02', '2024-12-05', 4, '家中有事', 'approved')
  `);

  database.run(`
    INSERT INTO leave_records (student_id, leave_type, start_date, end_date, days, reason, status)
    VALUES (${s3Id}, '病假', '2024-12-08', '2024-12-12', 5, '感冒发烧', 'approved')
  `);

  database.run(`
    INSERT INTO leave_records (student_id, leave_type, start_date, end_date, days, reason, status)
    VALUES (${s3Id}, '事假', '2024-12-23', '2024-12-25', 3, '参加婚礼', 'approved')
  `);

  database.run(`
    INSERT INTO leave_records (student_id, leave_type, start_date, end_date, days, reason, status)
    VALUES (${s5Id}, '病假', '2024-12-15', '2024-12-19', 5, '咳嗽请假', 'approved')
  `);

  saveDb();
}

async function all(sql, params = []) {
  const database = await getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  
  return results;
}

async function get(sql, params = []) {
  const database = await getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  
  return result;
}

async function run(sql, params = []) {
  const database = await getDb();
  const stmt = database.prepare(sql);
  const info = stmt.run(params);
  stmt.free();
  saveDb();
  
  const lastIdResult = database.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] || 0;
  
  return { changes: info?.changes || 1, lastInsertRowid };
}

module.exports = {
  initDatabase,
  seedSampleData,
  all,
  get,
  run
};
