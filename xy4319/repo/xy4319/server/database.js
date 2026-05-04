const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/triage.db');
const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 患者表
      db.run(`
        CREATE TABLE IF NOT EXISTS patients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER,
          gender TEXT,
          chiefComplaint TEXT,
          triageLevel TEXT,
          triageTime TEXT,
          arrivalTime TEXT,
          status TEXT DEFAULT 'waiting',
          targetDepartment TEXT,
          bedId TEXT,
          ambulanceId TEXT,
          notes TEXT,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);

      // 科室表
      db.run(`
        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          totalBeds INTEGER DEFAULT 10,
          availableBeds INTEGER DEFAULT 10,
          capacityRatio REAL DEFAULT 0.0,
          isActive INTEGER DEFAULT 1,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);

      // 床位表
      db.run(`
        CREATE TABLE IF NOT EXISTS beds (
          id TEXT PRIMARY KEY,
          departmentId TEXT NOT NULL,
          bedNumber TEXT NOT NULL,
          status TEXT DEFAULT 'available',
          patientId TEXT,
          occupiedAt TEXT,
          releasedAt TEXT,
          FOREIGN KEY (departmentId) REFERENCES departments(id)
        )
      `);

      // 救护车表
      db.run(`
        CREATE TABLE IF NOT EXISTS ambulances (
          id TEXT PRIMARY KEY,
          plateNumber TEXT NOT NULL,
          status TEXT DEFAULT 'idle',
          currentPatientId TEXT,
          estimatedArrivalTime TEXT,
          actualArrivalTime TEXT,
          location TEXT,
          notes TEXT,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);

      // 转运队列表
      db.run(`
        CREATE TABLE IF NOT EXISTS transfer_queue (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          priority INTEGER DEFAULT 1,
          queuePosition INTEGER,
          status TEXT DEFAULT 'pending',
          assignedAt TEXT,
          transferredAt TEXT,
          fromDepartment TEXT,
          toDepartment TEXT,
          reason TEXT,
          FOREIGN KEY (patientId) REFERENCES patients(id)
        )
      `);

      // 操作日志表
      db.run(`
        CREATE TABLE IF NOT EXISTS operation_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          operator TEXT DEFAULT 'system',
          action TEXT NOT NULL,
          entityType TEXT,
          entityId TEXT,
          details TEXT,
          severity TEXT DEFAULT 'info'
        )
      `);

      // 演练会话表
      db.run(`
        CREATE TABLE IF NOT EXISTS drill_sessions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          startTime TEXT,
          endTime TEXT,
          status TEXT DEFAULT 'active',
          description TEXT,
          totalPatients INTEGER DEFAULT 0,
          criticalIncidents INTEGER DEFAULT 0,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);

      // 异常事件表
      db.run(`
        CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY,
          sessionId TEXT,
          patientId TEXT,
          type TEXT NOT NULL,
          description TEXT,
          timestamp TEXT,
          severity TEXT DEFAULT 'warning',
          isResolved INTEGER DEFAULT 0,
          resolvedAt TEXT,
          resolvedBy TEXT,
          FOREIGN KEY (sessionId) REFERENCES drill_sessions(id),
          FOREIGN KEY (patientId) REFERENCES patients(id)
        )
      `);

      resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initializeDatabase,
  runQuery,
  getQuery,
  allQuery,
  uuidv4
};
