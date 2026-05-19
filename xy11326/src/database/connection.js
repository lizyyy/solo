const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { logError } = require('../utils/logger');

const dbPath = config.db.path;
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logError('database_connection', err);
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        logError('database_query', err, 'system', { sql, params });
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        logError('database_query', err, 'system', { sql, params });
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const getAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        logError('database_query', err, 'system', { sql, params });
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const serialize = () => {
  return new Promise((resolve) => {
    db.serialize(() => {
      resolve();
    });
  });
};

module.exports = {
  db,
  runQuery,
  getOne,
  getAll,
  serialize
};
