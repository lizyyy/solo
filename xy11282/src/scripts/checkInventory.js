const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/pharmacy.db');
const db = new sqlite3.Database(dbPath);

db.all(`SELECT * FROM inventory`, [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('库存表数据 (共' + rows.length + '条):');
    rows.forEach(row => {
      console.log(`  ID ${row.id}: 药品${row.medicineId} - ${row.batchNumber}, 过期: ${row.expiryDate}, 数量: ${row.quantity}`);
    });
  }
  db.close();
});
