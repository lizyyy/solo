const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/lacquer.db');

let db = null;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      } else {
        console.log('数据库连接成功');
      }
    });
  }
  return db;
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('关闭数据库失败:', err.message);
      } else {
        console.log('数据库连接已关闭');
      }
    });
    db = null;
  }
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function runTransaction(queries) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.serialize(() => {
      database.run('BEGIN TRANSACTION');
      
      const promises = queries.map(query => {
        return new Promise((res, rej) => {
          database.run(query.sql, query.params || [], function(err) {
            if (err) {
              rej(err);
            } else {
              res({ lastID: this.lastID, changes: this.changes });
            }
          });
        });
      });
      
      Promise.all(promises)
        .then(results => {
          database.run('COMMIT', (err) => {
            if (err) {
              database.run('ROLLBACK');
              reject(err);
            } else {
              resolve(results);
            }
          });
        })
        .catch(err => {
          database.run('ROLLBACK');
          reject(err);
        });
    });
  });
}

module.exports = {
  getDatabase,
  closeDatabase,
  run,
  get,
  all,
  runTransaction
};
