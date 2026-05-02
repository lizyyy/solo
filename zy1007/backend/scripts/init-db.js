const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('数据目录已创建:', dataDir);
}

const db = require('../database');

const { v4: uuidv4 } = require('uuid');

const sampleParts = [
  { id: uuidv4(), name: '屏幕总成', model: 'iPhone 14', stock: 10, safe_stock: 5, unit: '个', price: 800 },
  { id: uuidv4(), name: '电池', model: '通用型', stock: 20, safe_stock: 10, unit: '块', price: 150 },
  { id: uuidv4(), name: '充电接口', model: 'Type-C', stock: 3, safe_stock: 10, unit: '个', price: 80 },
  { id: uuidv4(), name: '主板', model: '华为 Mate 30', stock: 2, safe_stock: 3, unit: '块', price: 1200 },
  { id: uuidv4(), name: '摄像头', model: 'iPhone 13 Pro', stock: 5, safe_stock: 5, unit: '个', price: 500 }
];

db.serialize(() => {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO spare_parts (id, name, model, stock, safe_stock, unit, price, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  sampleParts.forEach(part => {
    insertStmt.run(part.id, part.name, part.model, part.stock, part.safe_stock, part.unit, part.price, now, now);
  });

  insertStmt.finalize((err) => {
    if (err) {
      console.error('初始化数据失败:', err.message);
    } else {
      console.log('数据库初始化完成，已添加示例备件数据');
    }
    db.close();
  });
});
