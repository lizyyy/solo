const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

const dbPath = path.join(__dirname, '../../data/database.db');
const db = new sqlite3.Database(dbPath);

db.run = promisify(db.run);
db.get = promisify(db.get);
db.all = promisify(db.all);

module.exports = db;
