const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const schemaSQL = require('./schema');

let db = null;

function ensureDataDir() {
  const dataDir = path.dirname(config.db.path);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    ensureDataDir();
    
    db = new sqlite3.Database(config.db.path, (err) => {
      if (err) {
        return reject(err);
      }
      
      db.exec(schemaSQL, (err) => {
        if (err) {
          return reject(err);
        }
        resolve(db);
      });
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) {
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

function runTransaction(queries) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.serialize(() => {
      database.run('BEGIN TRANSACTION');
      
      const results = [];
      let hasError = false;
      
      for (let i = 0; i < queries.length; i++) {
        const { sql, params = [] } = queries[i];
        database.run(sql, params, function(err) {
          if (err && !hasError) {
            hasError = true;
            database.run('ROLLBACK');
            return reject(err);
          }
          results.push({ lastID: this.lastID, changes: this.changes });
          
          if (i === queries.length - 1) {
            database.run('COMMIT', (err) => {
              if (err) {
                return reject(err);
              }
              resolve(results);
            });
          }
        });
      }
    });
  });
}

module.exports = {
  initDatabase,
  getDb,
  run,
  get,
  all,
  runTransaction
};