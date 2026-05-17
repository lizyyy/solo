import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../data/inspection.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      department TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      installDate TEXT NOT NULL,
      warrantyExpireDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inspectors (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      certificationLevel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inspection_plans (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      inspectorId TEXT NOT NULL,
      planDate TEXT NOT NULL,
      planTime TEXT NOT NULL,
      frequency TEXT NOT NULL,
      items TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (deviceId) REFERENCES devices(id),
      FOREIGN KEY (inspectorId) REFERENCES inspectors(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inspection_records (
      id TEXT PRIMARY KEY,
      planId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      inspectorId TEXT NOT NULL,
      planDate TEXT NOT NULL,
      actualInspectionDate TEXT,
      supplementReason TEXT,
      supplementDate TEXT,
      discoveredDate TEXT,
      status TEXT NOT NULL,
      flowType TEXT NOT NULL,
      remarks TEXT,
      attachmentUrls TEXT,
      requiredMaterials TEXT,
      inspectionResults TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (planId) REFERENCES inspection_plans(id),
      FOREIGN KEY (deviceId) REFERENCES devices(id),
      FOREIGN KEY (inspectorId) REFERENCES inspectors(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operation_history (
      id TEXT PRIMARY KEY,
      recordId TEXT NOT NULL,
      operationType TEXT NOT NULL,
      operatorId TEXT NOT NULL,
      operatorName TEXT NOT NULL,
      previousStatus TEXT,
      newStatus TEXT NOT NULL,
      remarks TEXT,
      operationTime TEXT NOT NULL,
      FOREIGN KEY (recordId) REFERENCES inspection_records(id)
    )`);

    console.log('数据表初始化完成');
  });
}

export default db;
