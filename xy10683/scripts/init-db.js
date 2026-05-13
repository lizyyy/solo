const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('初始化数据库...');
execSync('node server/database/init.js', { stdio: 'inherit' });

console.log('插入演示数据...');
execSync('node server/database/seed.js', { stdio: 'inherit' });

console.log('数据库初始化完成!');
