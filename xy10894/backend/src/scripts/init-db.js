const fs = require('fs');
const path = require('path');
const { initTables } = require('../database/schema');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initTables().then(() => {
  console.log('数据库初始化完成！');
  process.exit(0);
}).catch((err) => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
