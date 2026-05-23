const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/checkin.db');
const dbDir = path.dirname(dbPath);
const schemaPath = path.join(__dirname, '../database/schema.sql');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('已删除旧数据库文件');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库创建失败:', err.message);
  } else {
    console.log('已创建新数据库');
  }
});

db.serialize(() => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema, (err) => {
    if (err) {
      console.error('初始化数据库 schema 失败:', err.message);
    } else {
      console.log('数据库 schema 初始化完成');
      console.log('');
      console.log('数据库初始化成功!');
      console.log('下一步: 运行 npm run seed 导入样例数据');
    }
    db.close();
  });
});
