const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 数据库文件路径
const dbPath = path.join(__dirname, 'museum.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('无法连接到数据库:', err.message);
  } else {
    console.log('成功连接到SQLite数据库');
    initializeDatabase();
  }
});

// 初始化数据库
function initializeDatabase() {
  // 读取schema.sql文件
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // 执行schema.sql中的SQL语句
  db.exec(schema, (err) => {
    if (err) {
      console.error('数据库初始化失败:', err.message);
    } else {
      console.log('数据库初始化成功');
    }
  });
}

// 导出数据库连接对象
module.exports = db;
