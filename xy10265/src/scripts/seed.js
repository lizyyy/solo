const db = require('../db/database');

db.exec(`DELETE FROM decisions; DELETE FROM evaluations; DELETE FROM games; DELETE FROM attendances; DELETE FROM students;`);

const students = [
  { name: '陈小明', current_level: '初级班', join_date: '2023-06-01' },
  { name: '李小红', current_level: '中级班', join_date: '2022-09-15' },
  { name: '王小强', current_level: '入门班', join_date: '2024-01-01' }
];

const insertStudent = db.prepare('INSERT INTO students (name, current_level, join_date) VALUES (?, ?, ?)');
const insertGame = db.prepare('INSERT INTO games (student_id, opponent, opponent_level, result, game_date, notes) VALUES (?, ?, ?, ?, ?, ?)');
const insertAttendance = db.prepare('INSERT INTO attendances (student_id, attendance_date, status) VALUES (?, ?, ?)');

const student1 = insertStudent.run(students[0].name, students[0].current_level, students[0].join_date);
const student2 = insertStudent.run(students[1].name, students[1].current_level, students[1].join_date);
const student3 = insertStudent.run(students[2].name, students[2].current_level, students[2].join_date);

const gamesData = [
  [student1.lastInsertRowid, '张三', '初级班', 'win', '2024-01-05', ''],
  [student1.lastInsertRowid, '李四', '初级班', 'win', '2024-01-12', ''],
  [student1.lastInsertRowid, '王五', '中级班', 'win', '2024-01-19', '中局弃子战术'],
  [student1.lastInsertRowid, '赵六', '初级班', 'win', '2024-01-26', ''],
  [student1.lastInsertRowid, '孙七', '中级班', 'win', '2024-02-02', ''],
  [student1.lastInsertRowid, '周八', '初级班', 'draw', '2024-02-09', ''],
  [student1.lastInsertRowid, '吴九', '中级班', 'win', '2024-02-16', ''],
  [student2.lastInsertRowid, '高手甲', '高级班', 'lose', '2024-01-05', ''],
  [student2.lastInsertRowid, '高手乙', '中级班', 'win', '2024-01-12', ''],
  [student2.lastInsertRowid, '高手丙', '高级班', 'lose', '2024-01-19', ''],
  [student2.lastInsertRowid, '高手丁', '中级班', 'draw', '2024-01-26', ''],
  [student3.lastInsertRowid, '新手A', '入门班', 'lose', '2024-02-01', ''],
  [student3.lastInsertRowid, '新手B', '入门班', 'lose', '2024-02-08', '']
];

gamesData.forEach(g => insertGame.run(...g));

const attendanceData = [
  [student1.lastInsertRowid, '2024-01-01', 'present'],
  [student1.lastInsertRowid, '2024-01-08', 'present'],
  [student1.lastInsertRowid, '2024-01-15', 'present'],
  [student1.lastInsertRowid, '2024-01-22', 'present'],
  [student1.lastInsertRowid, '2024-01-29', 'present'],
  [student1.lastInsertRowid, '2024-02-05', 'late'],
  [student1.lastInsertRowid, '2024-02-12', 'present'],
  [student1.lastInsertRowid, '2024-02-19', 'present'],
  [student1.lastInsertRowid, '2024-02-26', 'present'],
  [student1.lastInsertRowid, '2024-03-04', 'present'],
  [student2.lastInsertRowid, '2024-01-01', 'present'],
  [student2.lastInsertRowid, '2024-01-08', 'absent'],
  [student2.lastInsertRowid, '2024-01-15', 'present'],
  [student2.lastInsertRowid, '2024-01-22', 'late'],
  [student2.lastInsertRowid, '2024-01-29', 'present'],
  [student3.lastInsertRowid, '2024-02-01', 'absent'],
  [student3.lastInsertRowid, '2024-02-08', 'absent'],
  [student3.lastInsertRowid, '2024-02-15', 'present']
];

attendanceData.forEach(a => insertAttendance.run(...a));

console.log('✅ 样例数据导入完成！');
console.log(`📚 学生数: ${db.prepare('SELECT COUNT(*) as n FROM students').get().n}`);
console.log(`🎮 对局数: ${db.prepare('SELECT COUNT(*) as n FROM games').get().n}`);
console.log(`📅 出勤数: ${db.prepare('SELECT COUNT(*) as n FROM attendances').get().n}`);
