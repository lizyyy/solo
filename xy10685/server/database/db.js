const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'vaccine.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('数据库连接成功');
});

module.exports = db;
