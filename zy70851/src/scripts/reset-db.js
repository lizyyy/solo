const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/claims.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('旧数据库已删除');
}

require('./init-db');
console.log('数据库已重置完成');
