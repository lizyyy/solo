const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/dental_equipment.db');
const db = new sqlite3.Database(dbPath);

function prepare(sql) {
  const stmt = db.prepare(sql);
  
  return {
    run: function(...args) {
      return new Promise((resolve, reject) => {
        stmt.run(...args, function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes, lastID: this.lastID });
        });
      });
    },
    get: function(...args) {
      return new Promise((resolve, reject) => {
        stmt.get(...args, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    all: function(...args) {
      return new Promise((resolve, reject) => {
        stmt.all(...args, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  };
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function transaction(callback) {
  return new Promise(async (resolve, reject) => {
    try {
      await new Promise((res, rej) => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) rej(err);
          else res();
        });
      });
      
      await callback();
      
      await new Promise((res, rej) => {
        db.run('COMMIT', (err) => {
          if (err) rej(err);
          else res();
        });
      });
      resolve();
    } catch (err) {
      await new Promise((res) => {
        db.run('ROLLBACK', () => res());
      });
      reject(err);
    }
  });
}

module.exports = {
  prepare,
  exec,
  transaction,
  raw: db
};
