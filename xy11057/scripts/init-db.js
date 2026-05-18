const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'artwork-storage.db');
const db = new sqlite3.Database(dbPath);

console.log('开始初始化数据库...');

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS inventory_records`);
  db.run(`DROP TABLE IF EXISTS artworks`);
  db.run(`DROP TABLE IF EXISTS stores`);

  db.run(`
    CREATE TABLE stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_code TEXT UNIQUE NOT NULL,
      store_name TEXT NOT NULL,
      address TEXT,
      manager TEXT,
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ 创建门店表');

  db.run(`
    CREATE TABLE artworks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artwork_code TEXT UNIQUE NOT NULL,
      artwork_name TEXT NOT NULL,
      artist TEXT NOT NULL,
      creation_year INTEGER,
      material TEXT,
      dimensions TEXT,
      estimated_value REAL NOT NULL,
      storage_location TEXT,
      condition TEXT,
      description TEXT,
      owner_name TEXT,
      owner_contact TEXT,
      status TEXT DEFAULT 'in_storage',
      requires_dual_auth INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ 创建艺术品表');

  db.run(`
    CREATE TABLE inventory_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_code TEXT UNIQUE NOT NULL,
      record_type TEXT NOT NULL,
      artwork_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      handler TEXT NOT NULL,
      record_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      quantity INTEGER DEFAULT 1,
      unit TEXT DEFAULT '件',
      remarks TEXT,
      register_code TEXT,
      has_dual_auth INTEGER DEFAULT 0,
      auth_by TEXT,
      auth_date TEXT,
      consistency_checked INTEGER DEFAULT 0,
      consistency_result TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artwork_id) REFERENCES artworks(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);
  console.log('✓ 创建出入库记录表');

  const storeStmt = db.prepare(`INSERT INTO stores (store_code, store_name, address, manager, phone) VALUES (?, ?, ?, ?, ?)`);
  storeStmt.run('ST001', '北京798艺术区门店', '北京市朝阳区798艺术区', '张明', '13800138001');
  storeStmt.run('ST002', '上海M50创意园门店', '上海市普陀区M50创意园', '李华', '13800138002');
  storeStmt.finalize();
  console.log('✓ 插入样例门店数据');

  const artworkStmt = db.prepare(`
    INSERT INTO artworks (
      artwork_code, artwork_name, artist, creation_year, material, dimensions,
      estimated_value, storage_location, condition, description, owner_name, owner_contact, status, requires_dual_auth
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  artworkStmt.run(
    'AW001', '星月夜', '梵高', 1889, '布面油画', '73.7×92.1cm',
    50000000, 'A区-01-01', '完好', '后印象派代表作', '王建国', '13900139001', 'in_storage', 1
  );
  artworkStmt.run(
    'AW002', '向日葵', '梵高', 1888, '布面油画', '92.1×73.7cm',
    30000000, 'A区-01-02', '完好', '静物油画代表作', '王建国', '13900139001', 'in_storage', 1
  );
  artworkStmt.run(
    'AW003', '山水图', '齐白石', 1930, '纸本水墨', '138×69cm',
    8000000, 'B区-02-01', '完好', '中国近代山水画', '陈雅芝', '13900139002', 'in_storage', 0
  );
  artworkStmt.run(
    'AW004', '奔马图', '徐悲鸿', 1940, '纸本设色', '130×76cm',
    12000000, 'B区-02-02', '完好', '国画骏马代表作', '林志强', '13900139003', 'in_storage', 0
  );
  artworkStmt.finalize();
  console.log('✓ 插入样例艺术品数据');

  const recordStmt = db.prepare(`
    INSERT INTO inventory_records (
      record_code, record_type, artwork_id, store_id, handler, record_date,
      status, register_code, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  recordStmt.run(
    'REC001', 'inbound', 1, 1, '张明', '2024-01-15',
    'completed', 'REG20240115001', '首次入库'
  );
  recordStmt.run(
    'REC002', 'inbound', 3, 1, '张明', '2024-01-16',
    'completed', 'REG20240116001', '客户寄存'
  );
  recordStmt.finalize();
  console.log('✓ 插入样例出入库记录');

  console.log('\n========================================');
  console.log('数据库初始化完成!');
  console.log('样例数据已加载:');
  console.log('  - 2个门店');
  console.log('  - 4件艺术品 (2件高估值需要二次授权)');
  console.log('  - 2条出入库记录');
  console.log('========================================\n');
});

db.close();