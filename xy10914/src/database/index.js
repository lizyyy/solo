const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const schema = require('./schema');

const dbPath = path.join(__dirname, '../../data/delivery.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.exec(schema, (err) => {
      if (err) {
        console.error('数据库初始化失败:', err.message);
        reject(err);
      } else {
        console.log('数据库表结构创建成功');
        resolve();
      }
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function beginTransaction() {
  return runQuery('BEGIN TRANSACTION');
}

function commit() {
  return runQuery('COMMIT');
}

function rollback() {
  return runQuery('ROLLBACK');
}

module.exports = {
  db,
  initializeDatabase,
  runQuery,
  getOne,
  getAll,
  beginTransaction,
  commit,
  rollback
};
