const initSqlJs = require('sql.js');
const fs = require('fs');

const DB_PATH = './inventory.db';

const seedData = [
  { sku: 'SKU001', product_name: '无线蓝牙耳机 Pro', location: 'A-01-01', expected_qty: 50, actual_qty: 48, unit: '台', operator: '张三', remark: '外观完好' },
  { sku: 'SKU002', product_name: '智能手表 Series 5', location: 'A-01-02', expected_qty: 30, actual_qty: 30, unit: '台', operator: '李四', remark: '' },
  { sku: 'SKU003', product_name: '便携充电宝 20000mAh', location: 'A-02-01', expected_qty: 100, actual_qty: 95, unit: '个', operator: '王五', remark: '部分外包装破损' },
  { sku: 'SKU004', product_name: 'Type-C 数据线 2m', location: 'A-02-02', expected_qty: 200, actual_qty: 210, unit: '根', operator: '赵六', remark: '多10根，需核实' },
  { sku: 'SKU005', product_name: '手机保护壳 透明款', location: 'B-01-01', expected_qty: 150, actual_qty: 150, unit: '个', operator: '张三', remark: '' },
  { sku: 'SKU006', product_name: '屏幕保护膜 高清', location: 'B-01-02', expected_qty: 300, actual_qty: 298, unit: '张', operator: '李四', remark: '' },
  { sku: 'SKU007', product_name: '笔记本支架 铝合金', location: 'B-02-01', expected_qty: 25, actual_qty: 25, unit: '个', operator: '王五', remark: '' },
  { sku: 'SKU008', product_name: '机械键盘 青轴', location: 'B-02-02', expected_qty: 40, actual_qty: 38, unit: '台', operator: '赵六', remark: '2台待返修' },
  { sku: 'SKU009', product_name: '无线鼠标 静音版', location: 'C-01-01', expected_qty: 80, actual_qty: 82, unit: '个', operator: '张三', remark: '多2个' },
  { sku: 'SKU010', product_name: '显示器支架 双屏', location: 'C-01-02', expected_qty: 15, actual_qty: 15, unit: '套', operator: '李四', remark: '' },
];

function getCurrentTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

async function main() {
  const SQL = await initSqlJs();
  
  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      location TEXT,
      expected_qty INTEGER DEFAULT 0,
      actual_qty INTEGER DEFAULT 0,
      unit TEXT DEFAULT '个',
      operator TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      sku TEXT,
      local_qty INTEGER,
      server_qty INTEGER,
      result TEXT NOT NULL,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const now = getCurrentTimestamp();
  
  for (const item of seedData) {
    db.run(`
      INSERT OR REPLACE INTO inventory_records 
      (sku, product_name, location, expected_qty, actual_qty, unit, operator, remark, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [item.sku, item.product_name, item.location, item.expected_qty, item.actual_qty, item.unit, item.operator, item.remark, now, now]);
  }

  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);

  db.close();

  console.log('✅ 种子数据已成功导入！');
  console.log(`📦 共导入 ${seedData.length} 条库存记录`);
  console.log(`💾 数据库文件: ${DB_PATH}`);
}

main().catch(err => {
  console.error('导入种子数据失败:', err);
  process.exit(1);
});
