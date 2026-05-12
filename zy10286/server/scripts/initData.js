const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../../data/database.db');
const db = new sqlite3.Database(dbPath);

const classes = [
  { id: uuidv4(), name: 'Python全栈班-01期', course_name: 'Python全栈开发', start_date: '2024-01-15', end_date: '2024-06-30' },
  { id: uuidv4(), name: 'Java架构师班-03期', course_name: 'Java高级架构', start_date: '2024-02-01', end_date: '2024-07-31' },
  { id: uuidv4(), name: '前端高级班-02期', course_name: 'React/Vue进阶', start_date: '2024-02-15', end_date: '2024-08-15' }
];

const students = [
  { id: uuidv4(), name: '张三', phone: '13800138001', email: 'zhangsan@example.com', id_card: '110101199001011234' },
  { id: uuidv4(), name: '李四', phone: '13800138002', email: 'lisi@example.com', id_card: '110101199002022345' },
  { id: uuidv4(), name: '王五', phone: '13800138003', email: 'wangwu@example.com', id_card: '110101199003033456' },
  { id: uuidv4(), name: '赵六', phone: '13800138004', email: 'zhaoliu@example.com', id_card: '110101199004044567' },
  { id: uuidv4(), name: '孙七', phone: '13800138005', email: 'sunqi@example.com', id_card: '110101199005055678' }
];

function createAccounts(studentId) {
  return [
    { id: uuidv4(), student_id: studentId, account_type: 'phone', account_identifier: students.find(s => s.id === studentId)?.phone, is_primary: 1 },
    { id: uuidv4(), student_id: studentId, account_type: 'email', account_identifier: students.find(s => s.id === studentId)?.email, is_primary: 0 }
  ];
}

const sessions = [];
classes.forEach(c => {
  for (let i = 1; i <= 5; i++) {
    sessions.push({
      id: uuidv4(),
      class_id: c.id,
      title: `第${i}课 - ${c.course_name.split('')[0]}基础`,
      session_date: `2024-0${Math.floor((i + 1) / 2) + 1}-${10 + i}`,
      start_time: '19:00:00',
      end_time: '21:00:00',
      replay_url: `https://example.com/replay/${c.id}/${i}`,
      replay_expiry_date: '2024-12-31'
    });
  }
});

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function initData() {
  try {
    console.log('开始初始化样例数据...');
    
    for (const c of classes) {
      await runAsync(
        `INSERT INTO classes (id, name, course_name, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
        [c.id, c.name, c.course_name, c.start_date, c.end_date]
      );
      console.log(`创建班级: ${c.name}`);
    }
    
    for (const s of students) {
      await runAsync(
        `INSERT INTO students (id, name, phone, email, id_card) VALUES (?, ?, ?, ?, ?)`,
        [s.id, s.name, s.phone, s.email, s.id_card]
      );
      console.log(`创建学员: ${s.name}`);
      
      const accounts = createAccounts(s.id);
      for (const a of accounts) {
        await runAsync(
          `INSERT INTO student_accounts (id, student_id, account_type, account_identifier, is_primary) VALUES (?, ?, ?, ?, ?)`,
          [a.id, a.student_id, a.account_type, a.account_identifier, a.is_primary]
        );
      }
    }
    
    for (const sess of sessions) {
      await runAsync(
        `INSERT INTO live_sessions (id, class_id, title, session_date, start_time, end_time, replay_url, replay_expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sess.id, sess.class_id, sess.title, sess.session_date, sess.start_time, sess.end_time, sess.replay_url, sess.replay_expiry_date]
      );
      console.log(`创建直播场次: ${sess.title}`);
    }
    
    const enrollmentDate = new Date().toISOString();
    const enrollments = [];
    
    for (let i = 0; i < 3; i++) {
      const enrollmentId = uuidv4();
      enrollments.push({ id: enrollmentId, student_id: students[i].id, class_id: classes[0].id });
      
      await runAsync(
        `INSERT INTO class_enrollments (id, class_id, student_id, enrollment_date) VALUES (?, ?, ?, ?)`,
        [enrollmentId, classes[0].id, students[i].id, enrollmentDate]
      );
      console.log(`学员 ${students[i].name} 加入班级 ${classes[0].name}`);
      
      const classSessions = sessions.filter(s => s.class_id === classes[0].id);
      for (const sess of classSessions) {
        const permId = uuidv4();
        await runAsync(
          `INSERT INTO replay_permissions (id, student_id, session_id, class_id, enrollment_id, granted_at, expires_at, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [permId, students[i].id, sess.id, classes[0].id, enrollmentId, enrollmentDate, '2024-12-31', 'active', 'enrollment']
        );
      }
    }
    
    enrollments.push({ id: uuidv4(), student_id: students[3].id, class_id: classes[1].id });
    await runAsync(
      `INSERT INTO class_enrollments (id, class_id, student_id, enrollment_date) VALUES (?, ?, ?, ?)`,
      [enrollments[3].id, classes[1].id, students[3].id, enrollmentDate]
    );
    console.log(`学员 ${students[3].name} 加入班级 ${classes[1].name}`);
    
    const class1Sessions = sessions.filter(s => s.class_id === classes[1].id);
    for (const sess of class1Sessions) {
      const permId = uuidv4();
      await runAsync(
        `INSERT INTO replay_permissions (id, student_id, session_id, class_id, enrollment_id, granted_at, expires_at, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [permId, students[3].id, sess.id, classes[1].id, enrollments[3].id, enrollmentDate, '2024-12-31', 'active', 'enrollment']
      );
    }
    
    await runAsync(
      `INSERT INTO business_events (id, event_type, entity_type, entity_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'system_init', 'system', 'global', '系统初始化完成，样例数据已加载', new Date().toISOString()]
    );
    
    console.log('\n✅ 样例数据初始化完成！');
    console.log(`班级数量: ${classes.length}`);
    console.log(`学员数量: ${students.length}`);
    console.log(`直播场次数量: ${sessions.length}`);
    
  } catch (error) {
    console.error('初始化数据失败:', error);
  } finally {
    db.close();
  }
}

initData();
