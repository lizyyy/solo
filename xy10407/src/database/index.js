const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(config.dbPath);
  }
  return db;
}

function getAsync() {
  const db = getDatabase();
  
  return {
    all: (sql, ...params) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    },
    get: (sql, ...params) => {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    run: (sql, ...params) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    exec: (sql) => {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    serialize: (callback) => {
      return db.serialize(callback);
    }
  };
}

module.exports = { getDatabase, getAsync };
