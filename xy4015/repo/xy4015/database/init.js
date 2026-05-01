const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'gym.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到SQLite数据库');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    status TEXT DEFAULT 'active',
    remaining_sessions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    duration INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    coach_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    capacity INTEGER DEFAULT 10,
    booked_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (coach_id) REFERENCES coaches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    schedule_id INTEGER NOT NULL,
    status TEXT DEFAULT 'booked',
    is_no_show INTEGER DEFAULT 0,
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    canceled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON bookings(schedule_id)`);

  const coaches = [
    { name: '张教练', phone: '13800138001' },
    { name: '李教练', phone: '13800138002' },
    { name: '王教练', phone: '13800138003' }
  ];

  const courses = [
    { name: '瑜伽', description: '舒缓身心的瑜伽课程', duration: 60 },
    { name: '动感单车', description: '高强度有氧训练', duration: 45 },
    { name: '力量训练', description: '专业力量训练指导', duration: 60 },
    { name: '普拉提', description: '核心力量训练', duration: 50 }
  ];

  db.run(`INSERT OR IGNORE INTO coaches (name, phone) VALUES (?, ?)`, [coaches[0].name, coaches[0].phone]);
  db.run(`INSERT OR IGNORE INTO coaches (name, phone) VALUES (?, ?)`, [coaches[1].name, coaches[1].phone]);
  db.run(`INSERT OR IGNORE INTO coaches (name, phone) VALUES (?, ?)`, [coaches[2].name, coaches[2].phone]);

  db.run(`INSERT OR IGNORE INTO courses (name, description, duration) VALUES (?, ?, ?)`, [courses[0].name, courses[0].description, courses[0].duration]);
  db.run(`INSERT OR IGNORE INTO courses (name, description, duration) VALUES (?, ?, ?)`, [courses[1].name, courses[1].description, courses[1].duration]);
  db.run(`INSERT OR IGNORE INTO courses (name, description, duration) VALUES (?, ?, ?)`, [courses[2].name, courses[2].description, courses[2].duration]);
  db.run(`INSERT OR IGNORE INTO courses (name, description, duration) VALUES (?, ?, ?)`, [courses[3].name, courses[3].description, courses[3].duration]);

  console.log('数据库初始化完成！');
  console.log('已添加示例教练和课程数据。');
});

db.close();
