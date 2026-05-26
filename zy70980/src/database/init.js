const sqlite3 = require('sqlite3').verbose();
const SCHEMA = require('./schema');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/maintenance.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到SQLite数据库');
});

db.serialize(() => {
  db.exec(SCHEMA, (err) => {
    if (err) {
      console.error('数据库初始化失败:', err.message);
      process.exit(1);
    }
    console.log('数据库表创建成功');
  });
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('数据库初始化完成');
});
