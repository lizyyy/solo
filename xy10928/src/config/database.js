const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'station.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function pragma(sql) {
  return new Promise((resolve, reject) => {
    db.run(`PRAGMA ${sql}`, [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function prepare(sql) {
  const stmt = db.prepare(sql);
  
  return {
    run: function(...params) {
      return new Promise((resolve, reject) => {
        stmt.run(...params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get: function(...params) {
      return new Promise((resolve, reject) => {
        stmt.get(...params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    all: function(...params) {
      return new Promise((resolve, reject) => {
        stmt.all(...params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  };
}

const initDb = async () => {
  await pragma('journal_mode = WAL');
  await pragma('foreign_keys = ON');
};

initDb().catch(console.error);

module.exports = {
  db,
  run,
  get,
  all,
  exec,
  pragma,
  prepare
};
