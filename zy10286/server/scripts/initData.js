const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/database.db');

// 确保 data 目录存在
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function createTables() {
  console.log('创建数据库表...');
  
  await runAsync(`CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    course_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    id_card TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS student_accounts (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    account_type TEXT NOT NULL,
    account_identifier TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS class_enrollments (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    enrollment_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    refund_date TEXT,
    transfer_from_id TEXT,
    transfer_to_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS live_sessions (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    title TEXT NOT NULL,
    session_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    replay_url TEXT,
    replay_expiry_date TEXT,
    status TEXT DEFAULT 'scheduled',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS replay_permissions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    enrollment_id TEXT NOT NULL,
    granted_at TEXT NOT NULL,
    expires_at TEXT,
    revoked_at TEXT,
    revoke_reason TEXT,
    status TEXT DEFAULT 'active',
    source TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS access_logs (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    account_identifier TEXT,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    access_time TEXT DEFAULT CURRENT_TIMESTAMP,
    access_type TEXT,
    was_allowed INTEGER DEFAULT 1,
    deny_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS business_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    description TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    operator TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS permission_anomalies (
    id TEXT PRIMARY KEY,
    anomaly_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    student_id TEXT,
    session_id TEXT,
    class_id TEXT,
    description TEXT NOT NULL,
    detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    resolver TEXT,
    status TEXT DEFAULT 'open',
    notes TEXT
  )`);

  console.log('✓ 数据库表创建完成');
}

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
  const student = students.find(s => s.id === studentId);
  return [
    { id: uuidv4(), student_id: studentId, account_type: 'phone', account_identifier: student?.phone, is_primary: 1 },
    { id: uuidv4(), student_id: studentId, account_type: 'email', account_identifier: student?.email, is_primary: 0 }
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

async function initData() {
  try {
    console.log('开始初始化样例数据...');
    
    await createTables();
    
    for (const c of classes) {
      await runAsync(
        `INSERT INTO classes (id, name, course_name, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
        [c.id, c.name, c.course_name, c.start_date, c.end_date]
      );
      console.log(`✓ 创建班级: ${c.name}`);
    }
    
    for (const s of students) {
      await runAsync(
        `INSERT INTO students (id, name, phone, email, id_card) VALUES (?, ?, ?, ?, ?)`,
        [s.id, s.name, s.phone, s.email, s.id_card]
      );
      console.log(`✓ 创建学员: ${s.name}`);
      
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
    }
    console.log(`✓ 创建直播场次: ${sessions.length} 个`);
    
    const enrollmentDate = new Date().toISOString();
    const enrollments = [];
    
    for (let i = 0; i < 3; i++) {
      const enrollmentId = uuidv4();
      enrollments.push({ id: enrollmentId, student_id: students[i].id, class_id: classes[0].id });
      
      await runAsync(
        `INSERT INTO class_enrollments (id, class_id, student_id, enrollment_date) VALUES (?, ?, ?, ?)`,
        [enrollmentId, classes[0].id, students[i].id, enrollmentDate]
      );
      console.log(`✓ 学员 ${students[i].name} 报名班级 ${classes[0].name}`);
      
      const classSessions = sessions.filter(s => s.class_id === classes[0].id);
      for (const sess of classSessions) {
        const permId = uuidv4();
        await runAsync(
          `INSERT INTO replay_permissions (id, student_id, session_id, class_id, enrollment_id, granted_at, expires_at, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [permId, students[i].id, sess.id, classes[0].id, enrollmentId, enrollmentDate, '2024-12-31', 'active', 'enrollment']
        );
      }
      console.log(`  ✓ 授予 ${classSessions.length} 个回放权限`);
    }
    
    enrollments.push({ id: uuidv4(), student_id: students[3].id, class_id: classes[1].id });
    await runAsync(
      `INSERT INTO class_enrollments (id, class_id, student_id, enrollment_date) VALUES (?, ?, ?, ?)`,
      [enrollments[3].id, classes[1].id, students[3].id, enrollmentDate]
    );
    console.log(`✓ 学员 ${students[3].name} 报名班级 ${classes[1].name}`);
    
    const class1Sessions = sessions.filter(s => s.class_id === classes[1].id);
    for (const sess of class1Sessions) {
      const permId = uuidv4();
      await runAsync(
        `INSERT INTO replay_permissions (id, student_id, session_id, class_id, enrollment_id, granted_at, expires_at, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [permId, students[3].id, sess.id, classes[1].id, enrollments[3].id, enrollmentDate, '2024-12-31', 'active', 'enrollment']
      );
    }
    console.log(`  ✓ 授予 ${class1Sessions.length} 个回放权限`);
    
    await runAsync(
      `INSERT INTO business_events (id, event_type, entity_type, entity_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'system_init', 'system', 'global', '系统初始化完成，样例数据已加载', new Date().toISOString()]
    );
    
    console.log('\n✅ 样例数据初始化完成！');
    console.log(`班级数量: ${classes.length}`);
    console.log(`学员数量: ${students.length}`);
    console.log(`直播场次数量: ${sessions.length}`);
    console.log(`已报名学员: 4 名`);
    
  } catch (error) {
    console.error('初始化数据失败:', error);
  } finally {
    db.close();
  }
}

initData();
