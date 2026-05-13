const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

class DBUtils {
  static generateId() {
    return uuidv4();
  }

  static now() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }

  static logOperation(module, operation, recordId, oldValue, newValue, operator) {
    const stmt = db.prepare(`
      INSERT INTO operation_logs (id, module, operation, record_id, old_value, new_value, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      this.generateId(),
      module,
      operation,
      recordId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      operator,
      this.now()
    );
  }

  static runQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }

  static getQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  }

  static allQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }

  static transaction(callback) {
    const tx = db.transaction(callback);
    return tx();
  }
}

module.exports = { db, DBUtils };
