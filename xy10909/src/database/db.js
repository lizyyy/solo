const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/access-control.db');
const db = new sqlite3.Database(dbPath);

class DatabaseWrapper {
  constructor(db) {
    this.db = db;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        return new Promise((resolve, reject) => {
          self.db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
          });
        });
      },
      get(...params) {
        return new Promise((resolve, reject) => {
          self.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      },
      all(...params) {
        return new Promise((resolve, reject) => {
          self.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      }
    };
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  pragma(statement) {
    return new Promise((resolve, reject) => {
      this.db.run(`PRAGMA ${statement}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

const wrapper = new DatabaseWrapper(db);

module.exports = wrapper;
