const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waybill_no VARCHAR(50) UNIQUE NOT NULL,
    receiver_name VARCHAR(100) NOT NULL,
    receiver_phone VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'in_stock',
    in_stock_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    pickup_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exception_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER NOT NULL,
    waybill_no VARCHAR(50) NOT NULL,
    exception_type VARCHAR(50) NOT NULL,
    exception_desc TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reported_by VARCHAR(100),
    reported_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_by VARCHAR(100),
    confirmed_time DATETIME,
    responsible_party VARCHAR(50),
    closed_by VARCHAR(100),
    closed_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER NOT NULL,
    waybill_no VARCHAR(50) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    operator VARCHAR(100),
    operation_desc TEXT,
    operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS compensations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exception_id INTEGER NOT NULL,
    package_id INTEGER NOT NULL,
    waybill_no VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    compensation_reason TEXT,
    paid_by VARCHAR(100),
    paid_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exception_id) REFERENCES exception_packages(id),
    FOREIGN KEY (package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_packages_waybill ON packages(waybill_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_exception_packages_package ON exception_packages(package_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_operation_history_package ON operation_history(package_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compensations_exception ON compensations(exception_id)`);

  console.log('数据库表创建完成');

  const testPackages = [
    { waybill_no: 'SF1234567890001', receiver_name: '张三', receiver_phone: '13800138001' },
    { waybill_no: 'SF1234567890002', receiver_name: '李四', receiver_phone: '13800138002' },
    { waybill_no: 'SF1234567890003', receiver_name: '王五', receiver_phone: '13800138003' },
    { waybill_no: 'SF1234567890004', receiver_name: '赵六', receiver_phone: '13800138004' },
    { waybill_no: 'SF1234567890005', receiver_name: '钱七', receiver_phone: '13800138005' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO packages (waybill_no, receiver_name, receiver_phone) VALUES (?, ?, ?)');
  testPackages.forEach(pkg => {
    stmt.run(pkg.waybill_no, pkg.receiver_name, pkg.receiver_phone);
  });
  stmt.finalize();

  console.log('测试数据初始化完成');
});

db.close();
