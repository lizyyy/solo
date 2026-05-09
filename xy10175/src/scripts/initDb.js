const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const tables = [
  `
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    customer_name TEXT,
    delivery_address TEXT,
    required_temp_min REAL NOT NULL,
    required_temp_max REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS boxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    box_number TEXT NOT NULL UNIQUE,
    order_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    responsible_person TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS temperature_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    box_number TEXT NOT NULL,
    order_number TEXT,
    temperature REAL NOT NULL,
    event_time DATETIME NOT NULL,
    is_alert BOOLEAN DEFAULT 0,
    threshold_min REAL,
    threshold_max REAL,
    shift_id INTEGER,
    shift_name TEXT,
    event_hash TEXT UNIQUE,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_id) REFERENCES shifts(id)
  )
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_events_box ON temperature_events(box_number);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_events_order ON temperature_events(order_number);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_events_time ON temperature_events(event_time);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_events_hash ON temperature_events(event_hash);
  `
];

const seedData = [
  {
    sql: `INSERT OR IGNORE INTO orders (order_number, product_name, customer_name, delivery_address, required_temp_min, required_temp_max) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    params: ['ORD-2024-001', '医用疫苗', '北京协和医院', '北京市东城区', 2, 8]
  },
  {
    sql: `INSERT OR IGNORE INTO orders (order_number, product_name, customer_name, delivery_address, required_temp_min, required_temp_max) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    params: ['ORD-2024-002', '生鲜海鲜', '上海大润发', '上海市浦东新区', -18, -12]
  },
  {
    sql: `INSERT OR IGNORE INTO orders (order_number, product_name, customer_name, delivery_address, required_temp_min, required_temp_max) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    params: ['ORD-2024-003', '生物样本', '广州实验室', '广州市天河区', -80, -60]
  },
  {
    sql: `INSERT OR IGNORE INTO boxes (box_number, order_id, status) VALUES (?, ?, ?)`,
    params: ['BOX-001', 1, 'active']
  },
  {
    sql: `INSERT OR IGNORE INTO boxes (box_number, order_id, status) VALUES (?, ?, ?)`,
    params: ['BOX-002', 1, 'active']
  },
  {
    sql: `INSERT OR IGNORE INTO boxes (box_number, order_id, status) VALUES (?, ?, ?)`,
    params: ['BOX-003', 2, 'active']
  },
  {
    sql: `INSERT OR IGNORE INTO boxes (box_number, order_id, status) VALUES (?, ?, ?)`,
    params: ['BOX-004', 3, 'active']
  },
  {
    sql: `INSERT OR IGNORE INTO shifts (shift_name, start_time, end_time, responsible_person) VALUES (?, ?, ?, ?)`,
    params: ['早班', '08:00:00', '16:00:00', '张三']
  },
  {
    sql: `INSERT OR IGNORE INTO shifts (shift_name, start_time, end_time, responsible_person) VALUES (?, ?, ?, ?)`,
    params: ['中班', '16:00:00', '00:00:00', '李四']
  },
  {
    sql: `INSERT OR IGNORE INTO shifts (shift_name, start_time, end_time, responsible_person) VALUES (?, ?, ?, ?)`,
    params: ['夜班', '00:00:00', '08:00:00', '王五']
  }
];

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function initDatabase() {
  try {
    console.log('开始创建数据表...');
    for (const sql of tables) {
      await runQuery(sql);
    }
    console.log('数据表创建完成');

    console.log('清空温度事件数据...');
    await runQuery('DELETE FROM temperature_events');
    console.log('温度事件数据已清空');

    console.log('开始插入初始数据...');
    for (const data of seedData) {
      await runQuery(data.sql, data.params);
    }
    console.log('初始数据插入完成');

    console.log('数据库初始化成功！');
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('数据库初始化失败:', err);
    db.close();
    process.exit(1);
  }
}

initDatabase();
