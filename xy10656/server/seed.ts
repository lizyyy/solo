import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dayjs from 'dayjs';

const dbPath = path.join(__dirname, '..', 'bus-attendance.db');
const db = new Database(dbPath);

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      studentNo TEXT UNIQUE NOT NULL,
      grade TEXT,
      class TEXT,
      parentName TEXT,
      parentPhone TEXT,
      defaultRouteId TEXT,
      defaultStopId TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      routeNo TEXT UNIQUE NOT NULL,
      driverName TEXT,
      driverPhone TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY,
      routeId TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      orderIndex INTEGER NOT NULL,
      morningTime TEXT,
      eveningTime TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leave_applications (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      leaveDate DATE NOT NULL,
      leaveType TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approvedBy TEXT,
      approvedAt DATETIME,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      routeId TEXT NOT NULL,
      stopId TEXT NOT NULL,
      attendanceDate DATE NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      actualStopId TEXT,
      changedBy TEXT,
      changeReason TEXT,
      parentConfirmed BOOLEAN DEFAULT 0,
      confirmedAt DATETIME,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS change_logs (
      id TEXT PRIMARY KEY,
      recordType TEXT NOT NULL,
      recordId TEXT NOT NULL,
      fieldName TEXT NOT NULL,
      oldValue TEXT,
      newValue TEXT,
      changedBy TEXT,
      changeReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedData() {
  db.exec('BEGIN TRANSACTION');

  try {
    const route1Id = uuidv4();
    const route2Id = uuidv4();
    
    const insertRoute = db.prepare(`
      INSERT INTO routes (id, name, routeNo, driverName, driverPhone, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertRoute.run(route1Id, '1号线(东校区)', 'R001', '张师傅', '13800138001', 'active');
    insertRoute.run(route2Id, '2号线(西校区)', 'R002', '李师傅', '13800138002', 'active');

    const stop1Id = uuidv4();
    const stop2Id = uuidv4();
    const stop3Id = uuidv4();
    const stop4Id = uuidv4();
    
    const insertStop = db.prepare(`
      INSERT INTO stops (id, routeId, name, address, orderIndex, morningTime, eveningTime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStop.run(stop1Id, route1Id, '东门站', '东校区东门', 1, '07:30', '17:30', 'active');
    insertStop.run(stop2Id, route1Id, '南门站', '东校区南门', 2, '07:35', '17:35', 'active');
    insertStop.run(stop3Id, route2Id, '西门站', '西校区西门', 1, '07:20', '17:20', 'active');
    insertStop.run(stop4Id, route2Id, '北门站', '西校区北门', 2, '07:25', '17:25', 'active');

    const insertStudent = db.prepare(`
      INSERT INTO students (id, name, studentNo, grade, class, parentName, parentPhone, defaultRouteId, defaultStopId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const studentIds: string[] = [];
    const students = [
      { name: '张三', studentNo: 'S2024001', grade: '一年级', class: '1班', parentName: '张父', parentPhone: '13900139001', routeId: route1Id, stopId: stop1Id },
      { name: '李四', studentNo: 'S2024002', grade: '一年级', class: '2班', parentName: '李母', parentPhone: '13900139002', routeId: route1Id, stopId: stop2Id },
      { name: '王五', studentNo: 'S2024003', grade: '二年级', class: '1班', parentName: '王父', parentPhone: '13900139003', routeId: route2Id, stopId: stop3Id },
      { name: '赵六', studentNo: 'S2024004', grade: '二年级', class: '2班', parentName: '赵母', parentPhone: '13900139004', routeId: route2Id, stopId: stop4Id },
      { name: '孙七', studentNo: 'S2024005', grade: '三年级', class: '1班', parentName: '孙父', parentPhone: '13900139005', routeId: route1Id, stopId: stop1Id },
    ];

    students.forEach((s) => {
      const id = uuidv4();
      studentIds.push(id);
      insertStudent.run(id, s.name, s.studentNo, s.grade, s.class, s.parentName, s.parentPhone, s.routeId, s.stopId, 'active');
    });

    const insertLeave = db.prepare(`
      INSERT INTO leave_applications (id, studentId, leaveDate, leaveType, reason, status, approvedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLeave.run(
      uuidv4(),
      studentIds[0],
      dayjs().format('YYYY-MM-DD'),
      '病假',
      '感冒发烧',
      'pending',
      null,
      dayjs().toISOString()
    );
    insertLeave.run(
      uuidv4(),
      studentIds[1],
      dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      '事假',
      '家中有事',
      'approved',
      '管理员',
      dayjs().subtract(1, 'day').toISOString()
    );

    const insertAttendance = db.prepare(`
      INSERT INTO attendance_records (id, studentId, routeId, stopId, attendanceDate, direction, status, actualStopId, parentConfirmed, changedBy, changeReason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const today = dayjs().format('YYYY-MM-DD');
    
    insertAttendance.run(
      uuidv4(),
      studentIds[0],
      route1Id,
      stop1Id,
      today,
      'morning',
      'normal',
      null,
      1,
      null,
      null
    );
    insertAttendance.run(
      uuidv4(),
      studentIds[1],
      route1Id,
      stop2Id,
      today,
      'morning',
      'changed',
      stop1Id,
      0,
      '操作员',
      '家长临时要求改站'
    );
    insertAttendance.run(
      uuidv4(),
      studentIds[2],
      route2Id,
      stop3Id,
      today,
      'morning',
      'absent',
      null,
      0,
      null,
      null
    );
    insertAttendance.run(
      uuidv4(),
      studentIds[3],
      route2Id,
      stop4Id,
      today,
      'morning',
      'normal',
      null,
      1,
      null,
      null
    );
    insertAttendance.run(
      uuidv4(),
      studentIds[4],
      route1Id,
      stop1Id,
      today,
      'morning',
      'normal',
      null,
      0,
      null,
      null
    );

    db.exec('COMMIT');
    console.log('Seed data inserted successfully!');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Error inserting seed data:', error);
    throw error;
  }
}

initDatabase();
seedData();
db.close();
