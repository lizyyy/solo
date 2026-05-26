const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('数据库目录已准备:', dataDir);
console.log('启动应用时会自动初始化数据库表结构');
