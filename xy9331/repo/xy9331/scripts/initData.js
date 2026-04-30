const db = require('../database');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const sampleUsers = [
  { username: 'manager', password: 'manager123', name: '张店长', role: 'admin' },
  { username: 'zhangsan', password: '123456', name: '张三', role: 'employee' },
  { username: 'lisi', password: '123456', name: '李四', role: 'employee' },
  { username: 'wangwu', password: '123456', name: '王五', role: 'employee' },
  { username: 'zhaoliu', password: '123456', name: '赵六', role: 'employee' },
];

function getWeekDates(baseDate) {
  const dates = [];
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - day + (day === 0 ? -6 : 1));
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

const today = new Date();
const thisWeekDates = getWeekDates(today);

const sampleShifts = [];

const shiftPatterns = [
  { start: '08:00', end: '16:00', type: '早班' },
  { start: '12:00', end: '20:00', type: '中班' },
  { start: '16:00', end: '22:00', type: '晚班' },
];

function initData() {
  db.serialize(async () => {
    db.run('BEGIN TRANSACTION');
    
    try {
      const insertUserStmt = db.prepare(`
        INSERT OR IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)
      `);

      const userPromises = sampleUsers.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
        return new Promise((resolve, reject) => {
          insertUserStmt.run(user.username, hashedPassword, user.name, user.role, function(err) {
            if (err) reject(err);
            resolve({ id: this.lastID, ...user });
          });
        });
      });

      const users = await Promise.all(userPromises);
      insertUserStmt.finalize();

      console.log('用户初始化完成');

      const employeeUsers = users.filter(u => u.role === 'employee');
      const insertShiftStmt = db.prepare(`
        INSERT OR IGNORE INTO shifts (user_id, date, start_time, end_time, shift_type)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < thisWeekDates.length; i++) {
        const date = thisWeekDates[i];
        const dayOfWeek = i;

        if (dayOfWeek >= 0 && dayOfWeek <= 4) {
          for (let j = 0; j < Math.min(3, employeeUsers.length); j++) {
            const user = employeeUsers[j];
            const pattern = shiftPatterns[j];
            insertShiftStmt.run(user.id, date, pattern.start, pattern.end, pattern.type);
          }
        } else {
          for (let j = 0; j < employeeUsers.length; j++) {
            const user = employeeUsers[j];
            const pattern = shiftPatterns[j % shiftPatterns.length];
            insertShiftStmt.run(user.id, date, pattern.start, pattern.end, pattern.type);
          }
        }
      }

      insertShiftStmt.finalize();
      
      db.run('COMMIT');
      console.log('示例数据初始化完成！');
      console.log('');
      console.log('登录账号：');
      console.log('店长: username=manager, password=manager123');
      console.log('员工: username=zhangsan, password=123456');
      console.log('员工: username=lisi, password=123456');
      console.log('员工: username=wangwu, password=123456');
      console.log('员工: username=zhaoliu, password=123456');
      
    } catch (error) {
      db.run('ROLLBACK');
      console.error('初始化失败:', error);
    }
    
    db.close();
  });
}

initData();
