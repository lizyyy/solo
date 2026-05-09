const getDB = require('../config/database');
const moment = require('moment');

async function initializeDatabase() {
  const db = getDB();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      industry TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      address TEXT,
      total_credit_limit REAL NOT NULL DEFAULT 0,
      available_credit REAL NOT NULL DEFAULT 0,
      used_credit REAL NOT NULL DEFAULT 0,
      credit_status TEXT NOT NULL DEFAULT 'normal',
      risk_level TEXT NOT NULL DEFAULT 'low',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      amount REAL NOT NULL,
      credit_used REAL NOT NULL,
      order_status TEXT NOT NULL DEFAULT 'pending',
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      return_no TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL,
      order_no TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      return_amount REAL NOT NULL,
      credit_released REAL NOT NULL,
      return_status TEXT NOT NULL DEFAULT 'pending',
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS credit_adjustments (
      id TEXT PRIMARY KEY,
      adjustment_no TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      adjustment_type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'pending',
      requester TEXT NOT NULL,
      approver TEXT,
      approval_time TEXT,
      approval_remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS credit_history (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      transaction_no TEXT NOT NULL,
      change_amount REAL NOT NULL,
      before_available REAL NOT NULL,
      after_available REAL NOT NULL,
      before_used REAL NOT NULL,
      after_used REAL NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS risk_alerts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      alert_level TEXT NOT NULL,
      alert_message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator'
    );
  `);

  const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    await seedUsers(db);
  }

  const customerCount = await db.prepare('SELECT COUNT(*) as count FROM customers').get();
  if (customerCount.count === 0) {
    await seedCustomers(db);
  }
}

async function seedUsers(db) {
  const stmt = db.prepare(`
    INSERT INTO users (id, username, password, role)
    VALUES (?, ?, ?, ?)
  `);
  await stmt.run('user1', 'admin', 'admin123', 'admin');
  await stmt.run('user2', 'operator', 'op123', 'operator');
  await stmt.run('user3', 'approver', 'ap123', 'approver');
}

async function seedCustomers(db) {
  const customers = [
    { id: 'c001', name: '阿里巴巴集团', code: 'ALIBABA', industry: '电子商务', contact_person: '张经理', contact_phone: '13800138001', address: '杭州市余杭区', total_credit_limit: 500000, available_credit: 500000, used_credit: 0 },
    { id: 'c002', name: '腾讯科技', code: 'TENCENT', industry: '互联网', contact_person: '李总', contact_phone: '13800138002', address: '深圳市南山区', total_credit_limit: 800000, available_credit: 800000, used_credit: 0 },
    { id: 'c003', name: '百度在线', code: 'BAIDU', industry: '人工智能', contact_person: '王总监', contact_phone: '13800138003', address: '北京市海淀区', total_credit_limit: 300000, available_credit: 300000, used_credit: 0 },
    { id: 'c004', name: '华为技术', code: 'HUAWEI', industry: '通信设备', contact_person: '陈经理', contact_phone: '13800138004', address: '深圳市龙岗区', total_credit_limit: 1200000, available_credit: 1200000, used_credit: 0 },
    { id: 'c005', name: '小米科技', code: 'XIAOMI', industry: '消费电子', contact_person: '刘总', contact_phone: '13800138005', address: '北京市昌平区', total_credit_limit: 400000, available_credit: 400000, used_credit: 0 }
  ];

  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, code, industry, contact_person, contact_phone, address, total_credit_limit, available_credit, used_credit, credit_status, risk_level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  for (const customer of customers) {
    await insertCustomer.run(
      customer.id,
      customer.name,
      customer.code,
      customer.industry,
      customer.contact_person,
      customer.contact_phone,
      customer.address,
      customer.total_credit_limit,
      customer.available_credit,
      customer.used_credit,
      'normal',
      'low',
      now,
      now
    );
  }
}

module.exports = { initializeDatabase };
