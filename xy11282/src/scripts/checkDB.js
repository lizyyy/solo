const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/pharmacy.db');
const db = new sqlite3.Database(dbPath);

db.all(`SELECT id, name, contraindications FROM medicines`, [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('药品表数据:');
    rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.name}`);
      console.log(`    contraindications 原始值:`, JSON.stringify(row.contraindications));
      try {
        const parsed = JSON.parse(row.contraindications);
        console.log(`    解析成功:`, parsed);
      } catch (e) {
        console.log(`    解析失败:`, e.message);
      }
    });
  }
  db.close();
});
