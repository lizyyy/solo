const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../src/config/database');

console.log('开始初始化数据库...');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('已创建 data 目录');
}

try {
  initDatabase();
  console.log('✅ 数据库初始化成功！');
  console.log(`📍 数据库位置: ${path.join(dataDir, 'database.db')}`);
} catch (error) {
  console.error('❌ 数据库初始化失败:', error.message);
  process.exit(1);
}
