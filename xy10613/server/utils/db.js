const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

function getDBConnection() {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('数据库连接失败:', err.message);
    }
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDBConnection();
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
      db.close();
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDBConnection();
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
      db.close();
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDBConnection();
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
      db.close();
    });
  });
}

module.exports = { query, run, get, getDBConnection };
