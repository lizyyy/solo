const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/database.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
  }
});

db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

module.exports = db;
