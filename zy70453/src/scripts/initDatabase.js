const fs = require('fs');
const path = require('path');
const { createTables } = require('../models/initTables');

const dataDir = path.join(__dirname, '../../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

createTables().then(() => {
  console.log('数据库表创建完成');
  console.log('请执行 npm run seed 生成演示数据');
  process.exit(0);
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});