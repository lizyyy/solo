const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('已创建 data 目录');
}

const dbPath = path.join(dataDir, 'database.db');
const db = new sqlite3.Database(dbPath);

const students = [
  { name: '张三', grade: '一年级', class_name: '1班', parent_name: '张父', parent_phone: '13800138001' },
  { name: '李四', grade: '一年级', class_name: '2班', parent_name: '李母', parent_phone: '13800138002' },
  { name: '王五', grade: '二年级', class_name: '1班', parent_name: '王父', parent_phone: '13800138003' },
  { name: '赵六', grade: '二年级', class_name: '2班', parent_name: '赵母', parent_phone: '13800138004' },
  { name: '孙七', grade: '三年级', class_name: '1班', parent_name: '孙父', parent_phone: '13800138005' }
];

const guardians = [
  { student_id: 1, name: '张父', relation: '父亲', phone: '13800138001', is_primary: 1 },
  { student_id: 1, name: '张母', relation: '母亲', phone: '13800138006', is_primary: 0 },
  { student_id: 2, name: '李母', relation: '母亲', phone: '13800138002', is_primary: 1 },
  { student_id: 3, name: '王父', relation: '父亲', phone: '13800138003', is_primary: 1 },
  { student_id: 4, name: '赵母', relation: '母亲', phone: '13800138004', is_primary: 1 },
  { student_id: 5, name: '孙父', relation: '父亲', phone: '13800138005', is_primary: 1 },
  { student_id: 5, name: '孙爷爷', relation: '祖父', phone: '13800138007', is_primary: 0 }
];

const today = new Date().toISOString().split('T')[0];

const authorizations = [
  { student_id: 1, guardian_id: 1, date: today, start_time: '16:00', end_time: '18:00', created_by: 'admin' },
  { student_id: 2, guardian_id: 3, date: today, start_time: '16:00', end_time: '18:00', created_by: 'admin' },
  { student_id: 3, guardian_id: 4, date: today, start_time: '16:00', end_time: '18:00', created_by: 'admin' },
  { student_id: 4, guardian_id: 5, date: today, start_time: '16:00', end_time: '18:00', created_by: 'admin' },
  { student_id: 5, guardian_id: 6, date: today, start_time: '16:00', end_time: '18:00', created_by: 'admin' },
  { student_id: 5, guardian_id: 7, date: today, start_time: '16:00', end_time: '18:00', created_by: 'admin' }
];

db.serialize(() => {
  console.log('开始插入样例数据...');
  
  const studentStmt = db.prepare('INSERT INTO students (name, grade, class_name, parent_name, parent_phone) VALUES (?, ?, ?, ?, ?)');
  students.forEach(s => {
    studentStmt.run(s.name, s.grade, s.class_name, s.parent_name, s.parent_phone);
  });
  studentStmt.finalize();
  console.log(`插入 ${students.length} 条学生数据`);
  
  const guardianStmt = db.prepare('INSERT INTO guardians (student_id, name, relation, phone, is_primary) VALUES (?, ?, ?, ?, ?)');
  guardians.forEach(g => {
    guardianStmt.run(g.student_id, g.name, g.relation, g.phone, g.is_primary);
  });
  guardianStmt.finalize();
  console.log(`插入 ${guardians.length} 条接送人数据`);
  
  const authStmt = db.prepare('INSERT INTO authorization_slots (student_id, guardian_id, date, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?, ?)');
  authorizations.forEach(a => {
    authStmt.run(a.student_id, a.guardian_id, a.date, a.start_time, a.end_time, a.created_by);
  });
  authStmt.finalize();
  console.log(`插入 ${authorizations.length} 条授权数据`);
  
  console.log('样例数据插入完成！');
  console.log(`今日日期: ${today}`);
  console.log('可以使用以下方式测试接送:');
  console.log('POST /api/pickups');
  console.log('Body: { "student_id": 1, "guardian_id": 1, "date": "' + today + '", "pickup_time": "16:30", "scheduled_time": "16:00", "verified_by": "admin" }');
});

db.close();
