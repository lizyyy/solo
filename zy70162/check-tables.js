const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data/app.db');
console.log('数据库路径:', DB_PATH);

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
`, [], (err, rows) => {
  if (err) {
    console.error('查询失败:', err);
    db.close();
    return;
  }
  
  console.log('\n数据库中的表:');
  rows.forEach(row => {
    console.log('  -', row.name);
  });
  
  console.log('\n表的数量:', rows.length);
  
  db.close();
});
