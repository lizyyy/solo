const Database = require('better-sqlite3');
const dbConfig = require('../config/database');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(dbConfig.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function runQuery(sql, params = []) {
  const db = getDb();
  return db.prepare(sql).run(params);
}

function getOne(sql, params = []) {
  const db = getDb();
  return db.prepare(sql).get(params);
}

function getAll(sql, params = []) {
  const db = getDb();
  return db.prepare(sql).all(params);
}

module.exports = {
  getDb,
  closeDb,
  runQuery,
  getOne,
  getAll
};
