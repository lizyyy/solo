const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { initSchema } = require('./schema');

const dbPath = path.join(__dirname, '../../data/appeal.db');

let dbInstance = null;

const getDbInstance = () => {
  if (!dbInstance) {
    const fs = require('fs');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      } else {
        console.log('数据库连接成功');
      }
    });
  }
  return dbInstance;
};

const initDatabase = async () => {
  const db = getDbInstance();
  await initSchema(db);
  return db;
};

const runQuery = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  getDbInstance,
  initDatabase,
  runQuery,
  getQuery,
  allQuery
};
