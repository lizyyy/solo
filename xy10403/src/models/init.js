const db = require('../config/database');
const bcrypt = require('bcryptjs');

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'approver', 'gate')),
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        department TEXT,
        phone TEXT,
        email TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS visitor_appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_name TEXT NOT NULL,
        id_card TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        visit_purpose TEXT,
        visitor_count INTEGER DEFAULT 1,
        employee_id INTEGER NOT NULL,
        visit_start_time DATETIME NOT NULL,
        visit_end_time DATETIME NOT NULL,
        access_gates TEXT,
        visitor_code TEXT UNIQUE,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'checkin', 'checkout', 'expired', 'cancelled')),
        approved_by INTEGER,
        approved_at DATETIME,
        checkin_time DATETIME,
        checkout_time DATETIME,
        expired_at DATETIME,
        cancelled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL,
        plate_number TEXT NOT NULL,
        vehicle_type TEXT,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES visitor_appointments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS access_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER,
        visitor_code TEXT,
        plate_number TEXT,
        gate_id TEXT NOT NULL,
        access_type TEXT NOT NULL CHECK(access_type IN ('checkin', 'checkout')),
        access_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        operator_id INTEGER,
        status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed')),
        failure_reason TEXT,
        FOREIGN KEY (appointment_id) REFERENCES visitor_appointments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS gates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gate_code TEXT UNIQUE NOT NULL,
        gate_name TEXT NOT NULL,
        location TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      resolve();
    });
  });
};

const seedData = async () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (err) return reject(err);
      
      if (row.count === 0) {
        const salt = bcrypt.genSaltSync(10);
        const password = bcrypt.hashSync('123456', salt);

        db.serialize(() => {
          db.run(`INSERT INTO users (username, password, role, name) VALUES 
            ('admin', ?, 'admin', '系统管理员'),
            ('approver', ?, 'approver', '审批员'),
            ('gate1', ?, 'gate', '东门闸口操作员'),
            ('gate2', ?, 'gate', '西门闸口操作员')`, [password, password, password, password]);

          db.run(`INSERT INTO employees (employee_no, name, department, phone, email) VALUES 
            ('EMP001', '张三', '技术部', '13800138001', 'zhangsan@example.com'),
            ('EMP002', '李四', '市场部', '13800138002', 'lisi@example.com'),
            ('EMP003', '王五', '行政部', '13800138003', 'wangwu@example.com')`);

          db.run(`INSERT INTO gates (gate_code, gate_name, location, status) VALUES 
            ('GATE001', '东门', '园区东侧', 'active'),
            ('GATE002', '西门', '园区西侧', 'active'),
            ('GATE003', '南门', '园区南侧', 'active'),
            ('GATE004', '北门', '园区北侧', 'active')`);
        });
      }
      
      resolve();
    });
  });
};

const initDatabase = async () => {
  await createTables();
  await seedData();
  console.log('数据库初始化完成');
};

module.exports = initDatabase;
