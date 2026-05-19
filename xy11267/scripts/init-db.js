const { execSync } = require('child_process');
const path = require('path');

console.log('开始初始化数据库...');

try {
  const initPath = path.join(__dirname, '../src/database/init.js');
  execSync(`node ${initPath}`, { stdio: 'inherit' });
  console.log('数据库初始化成功！');
} catch (error) {
  console.error('数据库初始化失败:', error.message);
  process.exit(1);
}
