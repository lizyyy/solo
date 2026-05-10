const path = require('path');
const fs = require('fs');

console.log('__dirname: ', __dirname);
console.log('process.cwd(): ', process.cwd());

const dbPath1 = path.join(__dirname, 'src/database', '../../data/app.db');
console.log('从根目录计算: ', dbPath1);
console.log('存在吗？', fs.existsSync(dbPath1));

const dbPath2 = path.join(__dirname, 'data/app.db');
console.log('直接 data/app.db: ', dbPath2);
console.log('存在吗？', fs.existsSync(dbPath2));

const dbPath3 = path.join(__dirname, 'src/database/../../data/app.db');
console.log('从 database 目录计算: ', dbPath3);
console.log('存在吗？', fs.existsSync(dbPath3));

console.log('\n列出 data 目录:');
try {
  console.log(fs.readdirSync(path.join(__dirname, 'data')));
} catch(e) {
  console.log('读取失败:', e.message);
}
