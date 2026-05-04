const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

const dbPath = config.db.path;

function ensureDir() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let db = null;

function init(callback) {
  ensureDir();
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to connect to database:', err);
      if (callback) callback(err);
      return;
    }
    console.log('Connected to SQLite database');
    db.run('PRAGMA journal_mode = WAL;', (err) => {
      if (callback) callback(err, db);
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.exec(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function serialize(callback) {
  const database = getDb();
  return database.serialize(callback);
}

module.exports = { 
  getDb, 
  init, 
  run, 
  get, 
  all, 
  exec,
  serialize,
};
