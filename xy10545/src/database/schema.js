const db = require('./db');

const initSchema = () => {
  db.loadDB();
  console.log('数据库已初始化 (JSON文件存储)');
};

module.exports = { initSchema };
