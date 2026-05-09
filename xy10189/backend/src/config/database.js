const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseWrapper {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
  }

  prepare(sql) {
    return new StatementWrapper(this.db, sql);
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  all(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  get(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  run(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}

class StatementWrapper {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  all(...params) {
    return new Promise((resolve, reject) => {
      this.db.all(this.sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  get(...params) {
    return new Promise((resolve, reject) => {
      this.db.get(this.sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  run(...params) {
    return new Promise((resolve, reject) => {
      this.db.run(this.sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}

const fs = require('fs');
const dbPath = path.join(__dirname, '../../data/credit.db');

let dbInstance = null;

function getDB() {
  if (!dbInstance) {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbInstance = new DatabaseWrapper(dbPath);
  }
  return dbInstance;
}

module.exports = getDB;
