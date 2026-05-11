const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || './warehouse.db';
const db = new Database(path.resolve(dbPath));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
