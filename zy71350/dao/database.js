const Database = require('better-sqlite3');
const config = require('../config');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(config.DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = { getDb, closeDb };
