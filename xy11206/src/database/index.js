const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/pharmacy.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      }
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  prepare(sql) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(sql, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            run: (params = []) => new Promise((res, rej) => {
              stmt.run(params, function(e) {
                if (e) rej(e);
                else res({ lastID: this.lastID, changes: this.changes });
              });
            }),
            finalize: () => new Promise((res) => stmt.finalize(res))
          });
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  serialize(callback) {
    return this.db.serialize(callback);
  }
}

module.exports = new Database();
