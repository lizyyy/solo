const { initializeTables, DB_PATH } = require('../database');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('正在初始化数据库...');
  
  if (fs.existsSync(DB_PATH)) {
    console.log(`删除旧数据库: ${DB_PATH}`);
    fs.unlinkSync(DB_PATH);
  }
  
  await initializeTables();
  console.log('数据库初始化完成！');
  console.log(`数据库文件: ${DB_PATH}`);
  process.exit(0);
})();
