const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/canteen.db');
let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      }
    });
    db.get('PRAGMA foreign_keys = ON');
  }
  return db;
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

async function recordHistory(operationType, entityType, entityId, operator, details = {}) {
  const sql = `
    INSERT INTO operation_history (operation_type, entity_type, entity_id, operator, details)
    VALUES (?, ?, ?, ?, ?)
  `;
  return runQuery(sql, [operationType, entityType, entityId, operator, JSON.stringify(details)]);
}

async function recordImportError(importType, fileName, rowNumber, originalData, errorMessage, suggestions = '') {
  const sql = `
    INSERT INTO import_errors (import_type, file_name, row_number, original_data, error_message, suggestions)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  return runQuery(sql, [importType, fileName, rowNumber, JSON.stringify(originalData), errorMessage, suggestions]);
}

module.exports = {
  getDb,
  runQuery,
  getAll,
  getOne,
  recordHistory,
  recordImportError
};
