const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const dbPath = path.join(__dirname, '../../data/operation.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(dbPath);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async beginTransaction() {
    await this.run('BEGIN TRANSACTION');
  }

  async commit() {
    await this.run('COMMIT');
  }

  async rollback() {
    await this.run('ROLLBACK');
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  generateId() {
    return uuidv4();
  }

  now() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }

  formatDate(date) {
    return moment(date).format('YYYY-MM-DD HH:mm:ss');
  }
}

module.exports = new Database();
