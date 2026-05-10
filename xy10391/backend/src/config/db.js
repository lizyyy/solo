const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/dues.db');

const db = new Database(dbPath, { verbose: console.log });

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
