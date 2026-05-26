const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbInstance = null;

function getDb(dbPath) {
  if (dbInstance) return dbInstance;

  const resolvedPath = path.resolve(dbPath);
  dbInstance = new sqlite3.Database(resolvedPath);
  dbInstance.serialize();
  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbInstance.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastId: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbInstance.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbInstance.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

module.exports = { getDb, closeDb, run, all, get };
