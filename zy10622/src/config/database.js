const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/auth-permissions.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到 SQLite 数据库');
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
});

module.exports = db;
module.exports.DB_PATH = DB_PATH;
