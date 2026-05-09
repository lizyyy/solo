const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_DATA_PATH = path.join(__dirname, '..', 'data', 'app.db.json');

if (fs.existsSync(DB_DATA_PATH)) {
  console.log('数据库已存在，先删除旧数据...');
  fs.unlinkSync(DB_DATA_PATH);
}

let db = null;
let SQL = null;

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_DATA_PATH, JSON.stringify(Array.from(data)));
}

function getLastInsertId() {
  const stmt = db.exec('SELECT last_insert_rowid() as id');
  return stmt[0]?.values[0][0];
}

function logHistory(recordType, recordId, action, details = null) {
  db.run(`
    INSERT INTO history (record_type, record_id, action, details)
    VALUES (?, ?, ?, ?)
  `, [recordType, recordId, action, details ? JSON.stringify(details) : null]);
}

async function main() {
  SQL = await initSqlJs();
  db = new SQL.Database();
  
  db.run(`
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      birth_date TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      total_classes INTEGER NOT NULL,
      used_classes INTEGER DEFAULT 0,
      frozen_classes INTEGER DEFAULT 0,
      purchase_date TEXT DEFAULT (date('now')),
      expire_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      class_date TEXT NOT NULL,
      class_time TEXT,
      status TEXT DEFAULT 'attended',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    
    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      leave_date TEXT NOT NULL,
      reason TEXT,
      classes_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    
    CREATE TABLE IF NOT EXISTS freezes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      reason TEXT,
      classes_frozen INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );
  `);
  
  console.log('正在创建样例数据...');

  const children = [
    { name: '小明', birth_date: '2021-03-15', parent_name: '张爸爸', parent_phone: '13800138001' },
    { name: '小红', birth_date: '2020-11-20', parent_name: '李妈妈', parent_phone: '13800138002' },
    { name: '小华', birth_date: '2021-07-08', parent_name: '王爸爸', parent_phone: '13800138003' }
  ];

  const childStmt = `
    INSERT INTO children (name, birth_date, parent_name, parent_phone)
    VALUES (?, ?, ?, ?)
  `;
  const childIds = children.map(c => {
    db.run(childStmt, [c.name, c.birth_date, c.parent_name, c.parent_phone]);
    const id = getLastInsertId();
    logHistory('child', id, 'create', { name: c.name });
    return id;
  });

  const courses = [
    { name: '创意美术课', duration: 1, description: '培养孩子创造力的美术启蒙课程' },
    { name: '音乐启蒙课', duration: 1, description: '通过音乐游戏培养节奏感' },
    { name: '感统训练课', duration: 1, description: '感觉统合训练，提升协调能力' },
    { name: '英语启蒙课', duration: 1, description: '寓教于乐的英语环境浸润' }
  ];

  const courseStmt = `
    INSERT INTO courses (name, duration, description)
    VALUES (?, ?, ?)
  `;
  const courseIds = courses.map(c => {
    db.run(courseStmt, [c.name, c.duration, c.description]);
    const id = getLastInsertId();
    logHistory('course', id, 'create', { name: c.name });
    return id;
  });

  const today = new Date();
  const formatDate = (date) => date.toISOString().split('T')[0];
  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const packages = [
    { child_id: childIds[0], course_id: courseIds[0], total_classes: 24, purchase_date: formatDate(addDays(today, -60)), expire_date: formatDate(addDays(today, 300)) },
    { child_id: childIds[0], course_id: courseIds[1], total_classes: 12, purchase_date: formatDate(addDays(today, -30)), expire_date: formatDate(addDays(today, 150)) },
    { child_id: childIds[1], course_id: courseIds[0], total_classes: 48, purchase_date: formatDate(addDays(today, -120)), expire_date: formatDate(addDays(today, 240)) },
    { child_id: childIds[1], course_id: courseIds[2], total_classes: 12, purchase_date: formatDate(addDays(today, -15)), expire_date: formatDate(addDays(today, 165)) },
    { child_id: childIds[2], course_id: courseIds[3], total_classes: 24, purchase_date: formatDate(addDays(today, -45)), expire_date: formatDate(addDays(today, 135)) }
  ];

  const packageStmt = `
    INSERT INTO packages (child_id, course_id, total_classes, purchase_date, expire_date)
    VALUES (?, ?, ?, ?, ?)
  `;
  const packageIds = packages.map(p => {
    db.run(packageStmt, [p.child_id, p.course_id, p.total_classes, p.purchase_date, p.expire_date]);
    const id = getLastInsertId();
    logHistory('package', id, 'create', {
      total_classes: p.total_classes,
      purchase_date: p.purchase_date,
      expire_date: p.expire_date
    });
    return id;
  });

  console.log('正在生成历史消费记录...');

  const packageConsumption = [
    { pkgIndex: 0, count: 8 },
    { pkgIndex: 1, count: 3 },
    { pkgIndex: 2, count: 20 },
    { pkgIndex: 3, count: 1 },
    { pkgIndex: 4, count: 5 }
  ];

  const attendanceStmt = `
    INSERT INTO attendances (package_id, child_id, course_id, class_date, class_time, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  packageConsumption.forEach(({ pkgIndex, count }) => {
    const pkgId = packageIds[pkgIndex];
    const pkg = packages[pkgIndex];
    
    for (let i = 0; i < count; i++) {
      const classDate = formatDate(addDays(today, -60 + i * 7));
      const classTime = '09:30';
      
      db.run(attendanceStmt, [pkgId, pkg.child_id, pkg.course_id, classDate, classTime, null]);
      const attendanceId = getLastInsertId();
      logHistory('attendance', attendanceId, 'create', { class_date: classDate });
    }
    
    db.run('UPDATE packages SET used_classes = used_classes + ? WHERE id = ?', [count, pkgId]);
    logHistory('package', pkgId, 'consume', {
      classes_used: count,
      new_used: count
    });
  });

  console.log('正在生成请假记录...');

  const leaveStmt = `
    INSERT INTO leaves (package_id, child_id, course_id, leave_date, reason, classes_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const leaves = [
    { pkgIndex: 0, date: formatDate(addDays(today, -14)), reason: '孩子感冒发烧', count: 1 },
    { pkgIndex: 2, date: formatDate(addDays(today, -21)), reason: '家庭旅游', count: 2 }
  ];

  leaves.forEach(({ pkgIndex, date, reason, count }) => {
    const pkgId = packageIds[pkgIndex];
    const pkg = packages[pkgIndex];
    
    db.run(leaveStmt, [pkgId, pkg.child_id, pkg.course_id, date, reason, count]);
    const leaveId = getLastInsertId();
    
    db.run('UPDATE packages SET frozen_classes = frozen_classes + ? WHERE id = ?', [count, pkgId]);
    
    logHistory('leave', leaveId, 'create', { 
      leave_date: date, 
      classes_count: count 
    });
    logHistory('package', pkgId, 'freeze_leave', {
      classes_frozen: count
    });
  });

  saveDatabase();

  console.log('样例数据创建完成！');
  console.log('\n数据概览:');
  console.log(`  - 孩子: ${children.length} 位`);
  console.log(`  - 课程: ${courses.length} 门`);
  console.log(`  - 课包: ${packages.length} 个`);
  console.log(`  - 签到记录: ${packageConsumption.reduce((sum, p) => sum + p.count, 0)} 条`);
  console.log(`  - 请假记录: ${leaves.length} 条`);
  console.log('\n可以运行 npm start 启动服务，然后访问 http://localhost:3001');

  db.close();
}

main().catch(err => {
  console.error('初始化数据失败:', err);
  process.exit(1);
});
