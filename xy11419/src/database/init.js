const db = require('./store');

function initDatabase() {
  console.log('数据库初始化完成（JSON文件存储）');
  console.log('数据文件位置: data/store.json');
  return db;
}

module.exports = initDatabase;
