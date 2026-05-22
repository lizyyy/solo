const Database = require('better-sqlite3');
const path = require('path');
const { createTables } = require('./schema');

const DB_PATH = path.join(__dirname, '../../data/db/cold_chain.db');

let dbInstance = null;

const getDb = () => {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    createTables(dbInstance);
  }
  return dbInstance;
};

const closeDb = () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

const runInTransaction = (fn) => {
  const db = getDb();
  const tx = db.transaction(fn);
  return tx();
};

module.exports = {
  getDb,
  closeDb,
  runInTransaction
};
