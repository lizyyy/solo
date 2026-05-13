const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS flow_records`);
  db.run(`DROP TABLE IF EXISTS change_history`);
  db.run(`DROP TABLE IF EXISTS valuations`);

  db.run(`
    CREATE TABLE IF NOT EXISTS valuations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      appliance_brand TEXT NOT NULL,
      appliance_model TEXT,
      appliance_type TEXT,
      purchase_year INTEGER,
      online_valuation REAL,
      onsite_valuation REAL,
      final_price REAL,
      status TEXT DEFAULT 'pending',
      price_change_reason TEXT,
      cancel_reason TEXT,
      operator TEXT,
      reviewer TEXT,
      is_anomaly INTEGER DEFAULT 0,
      anomaly_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS flow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      valuation_id INTEGER,
      action TEXT NOT NULL,
      operator TEXT,
      remark TEXT,
      previous_status TEXT,
      new_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (valuation_id) REFERENCES valuations(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS change_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      valuation_id INTEGER,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (valuation_id) REFERENCES valuations(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_valuations_status ON valuations(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_valuations_order_no ON valuations(order_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_flow_records_valuation ON flow_records(valuation_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_change_history_valuation ON change_history(valuation_id)`);

  console.log('数据库表创建成功！');

  const sampleData = require('../data/sampleData');
  sampleData.initSampleData((err) => {
    if (err) {
      console.error('初始化样例数据失败:', err);
    } else {
      console.log('样例数据初始化成功！');
    }
    db.close();
  });
});
