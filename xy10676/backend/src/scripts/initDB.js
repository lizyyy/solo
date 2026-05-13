const fs = require('fs');
const path = require('path');
const db = require('../database/db');

const schemaPath = path.join(__dirname, '../database/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (err) => {
  if (err) {
    console.error('数据库初始化失败:', err.message);
  } else {
    console.log('数据库表创建成功');
  }
  db.close();
});
