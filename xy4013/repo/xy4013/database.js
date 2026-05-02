const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'study_room.db');
const db = new sqlite3.Database(dbPath);

const BUSINESS_START_HOUR = 8;  // 08:00
const BUSINESS_END_HOUR = 22;   // 22:00

// 初始化数据库表
db.serialize(() => {
  // 学员表
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 座位表
  db.run(`
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 套餐表
  db.run(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      hours REAL NOT NULL,
      used_hours REAL DEFAULT 0,
      price REAL,
      purchase_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students (id)
    )
  `);

  // 学员余额表
  db.run(`
    CREATE TABLE IF NOT EXISTS student_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      total_hours REAL DEFAULT 0,
      used_hours REAL DEFAULT 0,
      remaining_hours REAL DEFAULT 0,
      makeup_hours REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students (id)
    )
  `);

  // 预约表
  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      seat_id INTEGER NOT NULL,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      duration_hours REAL NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students (id),
      FOREIGN KEY (seat_id) REFERENCES seats (id)
    )
  `);

  // 请假补签记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS leave_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      reservation_id INTEGER,
      type TEXT NOT NULL,
      hours REAL NOT NULL,
      date DATE NOT NULL,
      status TEXT DEFAULT 'completed',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students (id),
      FOREIGN KEY (reservation_id) REFERENCES reservations (id)
    )
  `);

  // 创建索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reservations_seat ON reservations(seat_id, date, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reservations_student ON reservations(student_id, date, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leave_records_date ON leave_records(date)`);

  // 插入初始数据
  insertInitialData();
});

function insertInitialData() {
  // 检查是否已有数据
  db.get(`SELECT COUNT(*) as count FROM students`, (err, row) => {
    if (err) return;
    if (row.count === 0) {
      // 插入初始学员
      const students = [
        ['张三', '13800138001', 'zhangsan@example.com'],
        ['李四', '13800138002', 'lisi@example.com'],
        ['王五', '13800138003', 'wangwu@example.com']
      ];

      students.forEach(student => {
        db.run(`INSERT INTO students (name, phone, email) VALUES (?, ?, ?)`, student, function(err) {
          if (!err) {
            // 为每个学员创建初始余额和套餐
            const studentId = this.lastID;
            db.run(`INSERT INTO student_balances (student_id, total_hours, used_hours, remaining_hours, makeup_hours) VALUES (?, 10, 0, 10, 0)`, [studentId]);
            db.run(`INSERT INTO packages (student_id, hours, used_hours, price, purchase_date) VALUES (?, 10, 0, 200, DATE('now'))`, [studentId]);
          }
        });
      });

      // 插入初始座位
      const seats = [
        ['A1', '靠窗区'],
        ['A2', '靠窗区'],
        ['A3', '靠窗区'],
        ['B1', '中心区'],
        ['B2', '中心区'],
        ['B3', '中心区'],
        ['C1', '安静区'],
        ['C2', '安静区']
      ];

      seats.forEach(seat => {
        db.run(`INSERT INTO seats (name, location, status) VALUES (?, ?, 'active')`, seat);
      });

      console.log('初始数据插入成功');
    }
  });
}

module.exports = {
  db,
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR
};
