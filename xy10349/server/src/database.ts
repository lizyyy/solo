import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'rollcall.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      studentId TEXT NOT NULL UNIQUE,
      class TEXT,
      gender TEXT,
      phone TEXT,
      emergencyContact TEXT,
      groupId TEXT,
      status TEXT DEFAULT 'active',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (groupId) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacherId TEXT NOT NULL UNIQUE,
      phone TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meeting_points (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacherId TEXT,
      meetingPointId TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (teacherId) REFERENCES teachers(id),
      FOREIGN KEY (meetingPointId) REFERENCES meeting_points(id)
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      meetingPointId TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      operatorId TEXT,
      rawInput TEXT,
      notes TEXT,
      FOREIGN KEY (studentId) REFERENCES students(id),
      FOREIGN KEY (meetingPointId) REFERENCES meeting_points(id)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      meetingPointId TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      requestedBy TEXT,
      approvedBy TEXT,
      requestTime TEXT DEFAULT (datetime('now')),
      approvalTime TEXT,
      rawInput TEXT,
      FOREIGN KEY (studentId) REFERENCES students(id),
      FOREIGN KEY (meetingPointId) REFERENCES meeting_points(id)
    );

    CREATE TABLE IF NOT EXISTS group_changes (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      oldGroupId TEXT,
      newGroupId TEXT,
      reason TEXT,
      operatorId TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      rawInput TEXT,
      FOREIGN KEY (studentId) REFERENCES students(id),
      FOREIGN KEY (oldGroupId) REFERENCES groups(id),
      FOREIGN KEY (newGroupId) REFERENCES groups(id)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(studentId);
    CREATE INDEX IF NOT EXISTS idx_attendance_meeting ON attendance_records(meetingPointId);
    CREATE INDEX IF NOT EXISTS idx_leave_student ON leave_requests(studentId);
    CREATE INDEX IF NOT EXISTS idx_group_change_student ON group_changes(studentId);
  `);

  seedInitialData();
}

function seedInitialData() {
  const activityCount = db.prepare('SELECT COUNT(*) as count FROM activities').get() as { count: number };
  if (activityCount.count > 0) return;

  const insertActivity = db.prepare(`
    INSERT INTO activities (id, name, date, description, isActive)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTeacher = db.prepare(`
    INSERT INTO teachers (id, name, teacherId, phone)
    VALUES (?, ?, ?, ?)
  `);

  const insertMeetingPoint = db.prepare(`
    INSERT INTO meeting_points (id, name, location, description, orderIndex)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertGroup = db.prepare(`
    INSERT INTO groups (id, name, teacherId, meetingPointId)
    VALUES (?, ?, ?, ?)
  `);

  const insertStudent = db.prepare(`
    INSERT INTO students (id, name, studentId, class, gender, phone, emergencyContact, groupId, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertActivity.run('act-001', '春季研学活动', '2026-05-10', '春季户外研学活动', 1);

  insertTeacher.run('t-001', '张老师', 'T001', '13800138001');
  insertTeacher.run('t-002', '李老师', 'T002', '13800138002');
  insertTeacher.run('t-003', '王老师', 'T003', '13800138003');

  insertMeetingPoint.run('mp-001', '学校大门集合', '学校正门', '出发集合点', 1);
  insertMeetingPoint.run('mp-002', '博物馆入口', '历史博物馆正门', '第一站集合点', 2);
  insertMeetingPoint.run('mp-003', '科技馆大厅', '科技馆一楼大厅', '第二站集合点', 3);
  insertMeetingPoint.run('mp-004', '午餐餐厅', '指定餐厅', '午餐集合点', 4);
  insertMeetingPoint.run('mp-005', '返程集合点', '大巴停车场', '返程集合点', 5);

  insertGroup.run('g-001', '第一小组', 't-001', 'mp-001');
  insertGroup.run('g-002', '第二小组', 't-002', 'mp-001');
  insertGroup.run('g-003', '第三小组', 't-003', 'mp-001');

  const students = [
    { id: 's-001', studentId: 'S2024001', name: '陈小明', class: '高一(1)班', gender: '男', groupId: 'g-001' },
    { id: 's-002', studentId: 'S2024002', name: '李小红', class: '高一(1)班', gender: '女', groupId: 'g-001' },
    { id: 's-003', studentId: 'S2024003', name: '王小强', class: '高一(2)班', gender: '男', groupId: 'g-001' },
    { id: 's-004', studentId: 'S2024004', name: '刘小芳', class: '高一(2)班', gender: '女', groupId: 'g-002' },
    { id: 's-005', studentId: 'S2024005', name: '赵小华', class: '高一(1)班', gender: '男', groupId: 'g-002' },
    { id: 's-006', studentId: 'S2024006', name: '孙小美', class: '高一(1)班', gender: '女', groupId: 'g-002' },
    { id: 's-007', studentId: 'S2024007', name: '周小伟', class: '高一(3)班', gender: '男', groupId: 'g-003' },
    { id: 's-008', studentId: 'S2024008', name: '吴小丽', class: '高一(3)班', gender: '女', groupId: 'g-003' },
    { id: 's-009', studentId: 'S2024009', name: '郑小龙', class: '高一(2)班', gender: '男', groupId: 'g-003' },
    { id: 's-010', studentId: 'S2024010', name: '冯小雪', class: '高一(1)班', gender: '女', groupId: 'g-001' },
  ];

  students.forEach(s => {
    insertStudent.run(
      s.id, s.name, s.studentId, s.class, s.gender,
      `139${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      s.groupId,
      'active'
    );
  });
}

export default db;
