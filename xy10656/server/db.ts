import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'bus-attendance.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export function initDatabase() {
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
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (routeId) REFERENCES routes(id)
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
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (studentId) REFERENCES students(id)
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
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (studentId) REFERENCES students(id),
      FOREIGN KEY (routeId) REFERENCES routes(id),
      FOREIGN KEY (stopId) REFERENCES stops(id)
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

    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendanceDate);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(studentId);
    CREATE INDEX IF NOT EXISTS idx_leave_date ON leave_applications(leaveDate);
  `);
}

export default db;
