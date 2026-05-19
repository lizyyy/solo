const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = require('../db/database');

const tables = [
  `CREATE TABLE IF NOT EXISTS customer_apps (
    id TEXT PRIMARY KEY,
    app_name TEXT NOT NULL,
    app_code TEXT UNIQUE NOT NULL,
    callback_url TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS event_types (
    id TEXT PRIMARY KEY,
    event_code TEXT UNIQUE NOT NULL,
    event_name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_rules (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    event_type_id TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    is_active BOOLEAN DEFAULT 0,
    filter_config TEXT,
    delivery_endpoint TEXT,
    delivery_method TEXT DEFAULT 'POST',
    retry_count INTEGER DEFAULT 3,
    timeout_ms INTEGER DEFAULT 5000,
    idempotency_key TEXT,
    snapshot_before TEXT,
    snapshot_after TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES customer_apps(id),
    FOREIGN KEY (event_type_id) REFERENCES event_types(id)
  )`,
  `CREATE TABLE IF NOT EXISTS filter_conditions (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    operator TEXT NOT NULL,
    field_value TEXT NOT NULL,
    logical_operator TEXT DEFAULT 'AND',
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscription_rules(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS delivery_records (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    event_id TEXT,
    event_payload TEXT,
    status TEXT NOT NULL,
    http_status INTEGER,
    error_message TEXT,
    retry_attempt INTEGER DEFAULT 0,
    delivered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscription_rules(id)
  )`,
  `CREATE TABLE IF NOT EXISTS unsubscription_history (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    event_type_id TEXT NOT NULL,
    reason TEXT,
    operated_by TEXT,
    idempotency_key TEXT,
    snapshot_config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscription_rules(id)
  )`,
  `CREATE TABLE IF NOT EXISTS idempotency_records (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE NOT NULL,
    request_type TEXT NOT NULL,
    response_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  )`
];

const createTablesSequentially = (index) => {
  if (index >= tables.length) {
    console.log('所有表创建完成');
    insertSampleData();
    return;
  }

  db.run(tables[index], (err) => {
    if (err) {
      console.error(`表 ${index + 1} 创建失败:`, err.message);
    } else {
      console.log(`表 ${index + 1} 创建成功`);
    }
    createTablesSequentially(index + 1);
  });
};

const insertSampleData = () => {
  const sampleApps = [
    { id: 'app-001', app_name: '电商订单系统', app_code: 'ECOM_ORDER', callback_url: 'https://api.example.com/order/callback' },
    { id: 'app-002', app_name: '用户中心', app_code: 'USER_CENTER', callback_url: 'https://api.example.com/user/callback' }
  ];

  const sampleEvents = [
    { id: 'evt-001', event_code: 'ORDER_CREATED', event_name: '订单创建', category: 'order' },
    { id: 'evt-002', event_code: 'ORDER_PAID', event_name: '订单支付', category: 'order' },
    { id: 'evt-003', event_code: 'USER_REGISTERED', event_name: '用户注册', category: 'user' },
    { id: 'evt-004', event_code: 'USER_UPDATED', event_name: '用户信息更新', category: 'user' }
  ];

  let completed = 0;
  const total = sampleApps.length + sampleEvents.length;

  sampleApps.forEach(app => {
    db.run(
      'INSERT OR IGNORE INTO customer_apps (id, app_name, app_code, callback_url) VALUES (?, ?, ?, ?)',
      [app.id, app.app_name, app.app_code, app.callback_url],
      () => {
        completed++;
        if (completed >= total) finish();
      }
    );
  });

  sampleEvents.forEach(evt => {
    db.run(
      'INSERT OR IGNORE INTO event_types (id, event_code, event_name, category) VALUES (?, ?, ?, ?)',
      [evt.id, evt.event_code, evt.event_name, evt.category],
      () => {
        completed++;
        if (completed >= total) finish();
      }
    );
  });

  console.log('示例数据已插入');
};

const finish = () => {
  setTimeout(() => {
    console.log('数据库初始化完成!');
    db.close();
    process.exit(0);
  }, 500);
};

createTablesSequentially(0);
