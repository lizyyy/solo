const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../../config/default');
const logger = require('../utils/logger');

const dbPath = path.resolve(config.database.filename);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

const getConnection = () => {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('数据库连接失败:', err.message);
      } else {
        logger.info('数据库连接成功');
      }
    });
  }
  return db;
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const database = getConnection();
    database.run(sql, params, function(err) {
      if (err) {
        logger.error('SQL执行失败:', err.message, sql);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

const getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const database = getConnection();
    database.get(sql, params, (err, row) => {
      if (err) {
        logger.error('SQL查询失败:', err.message, sql);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const getAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const database = getConnection();
    database.all(sql, params, (err, rows) => {
      if (err) {
        logger.error('SQL查询失败:', err.message, sql);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const closeConnection = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          logger.error('数据库关闭失败:', err.message);
          reject(err);
        } else {
          db = null;
          logger.info('数据库连接已关闭');
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
};

const initTables = async () => {
  const database = getConnection();
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS forklifts (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      batteryLevel INTEGER NOT NULL DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'idle',
      operatorName TEXT,
      operatorPhone TEXT,
      operatorIdCard TEXT,
      lastMaintenanceDate TEXT,
      maintainerContact TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS charging_stations (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      forkliftId TEXT,
      chargingStartTime TEXT,
      estimatedEndTime TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (forkliftId) REFERENCES forklifts(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'night',
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      supervisorName TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(date, type)
    )`,
    
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      shiftId TEXT NOT NULL,
      forkliftId TEXT,
      type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      description TEXT,
      location TEXT,
      estimatedDuration INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      startTime TEXT,
      endTime TEXT,
      operatorName TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (shiftId) REFERENCES shifts(id),
      FOREIGN KEY (forkliftId) REFERENCES forklifts(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS history_logs (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      action TEXT NOT NULL,
      oldValue TEXT,
      newValue TEXT,
      operatorName TEXT,
      operatorRole TEXT,
      createdAt TEXT NOT NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updatedAt TEXT NOT NULL
    )`
  ];
  
  for (const tableSql of tables) {
    await runQuery(tableSql);
  }
  
  logger.info('数据库表初始化完成');
};

module.exports = {
  getConnection,
  runQuery,
  getOne,
  getAll,
  closeConnection,
  initTables
};