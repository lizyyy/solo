const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'counseling.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS counselors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      store_id INTEGER,
      phone TEXT,
      specialty TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      first_visit_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS followup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      followup_no TEXT UNIQUE NOT NULL,
      client_id INTEGER,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      original_appointment_id INTEGER,
      original_appointment_date DATE NOT NULL,
      original_appointment_time TEXT NOT NULL,
      counselor_id INTEGER,
      counselor_name TEXT,
      store_id INTEGER,
      store_name TEXT,
      reschedule_count INTEGER DEFAULT 0,
      last_reschedule_date DATE,
      reschedule_reason TEXT,
      followup_status TEXT DEFAULT 'pending',
      followup_result TEXT,
      followup_date DATE,
      followup_note TEXT,
      next_appointment_date DATE,
      next_appointment_time TEXT,
      assignee TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const storesStmt = db.prepare('INSERT INTO stores (name, address, phone) VALUES (?, ?, ?)');
  storesStmt.run('北京朝阳店', '北京市朝阳区建国路88号', '010-88888801');
  storesStmt.run('上海静安店', '上海市静安区南京西路1266号', '021-66666601');
  storesStmt.finalize();

  const counselorsStmt = db.prepare('INSERT INTO counselors (name, store_id, phone, specialty) VALUES (?, ?, ?, ?)');
  counselorsStmt.run('李医生', 1, '13800138001', '青少年心理咨询');
  counselorsStmt.run('王医生', 1, '13800138002', '婚姻家庭咨询');
  counselorsStmt.run('张医生', 2, '13900139001', '焦虑抑郁治疗');
  counselorsStmt.finalize();

  const clientsStmt = db.prepare('INSERT INTO clients (name, phone, age, gender, first_visit_date) VALUES (?, ?, ?, ?, ?)');
  clientsStmt.run('张明', '13600136001', 28, '男', '2024-01-15');
  clientsStmt.run('李华', '13600136002', 32, '女', '2024-02-20');
  clientsStmt.run('王芳', '13600136003', 24, '女', '2024-03-10');
  clientsStmt.finalize();

  const followupStmt = db.prepare(`
    INSERT INTO followup_records (
      followup_no, client_id, client_name, client_phone,
      original_appointment_date, original_appointment_time,
      counselor_id, counselor_name, store_id, store_name,
      reschedule_count, reschedule_reason,
      followup_status, assignee
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  followupStmt.run(
    'FU-20240501-001', 1, '张明', '13600136001',
    '2024-05-10', '14:00',
    1, '李医生', 1, '北京朝阳店',
    1, '临时有工作安排',
    'pending', '张助理'
  );
  
  followupStmt.run(
    'FU-20240501-002', 2, '李华', '13600136002',
    '2024-05-12', '10:00',
    2, '王医生', 1, '北京朝阳店',
    2, '身体不适',
    'completed', '李助理'
  );
  
  followupStmt.run(
    'FU-20240501-003', 3, '王芳', '13600136003',
    '2024-05-15', '15:30',
    3, '张医生', 2, '上海静安店',
    0, null,
    'pending', '王助理'
  );
  
  followupStmt.finalize();

  console.log('数据库初始化完成！');
});

db.close();
