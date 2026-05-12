const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'key_rotation.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS key_versions (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      version TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(service_id, environment, version)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS consumers (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      name TEXT NOT NULL,
      environment TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(service_id, name, environment)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rotation_plans (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      target_key_version_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT,
      started_at TEXT,
      closed_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rotation_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT NOT NULL,
      actor TEXT,
      action TEXT NOT NULL,
      environment TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS environment_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      dual_write_started_at TEXT,
      switch_at TEXT,
      rollback_reason TEXT,
      UNIQUE(plan_id, environment)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS consumer_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT NOT NULL,
      consumer_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      confirmed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(plan_id, consumer_id, environment)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      approver TEXT,
      approved_at TEXT DEFAULT (datetime('now')),
      notes TEXT,
      UNIQUE(plan_id, environment)
    );
  `);

  seedData();
  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function seedData() {
  const services = [
    { id: 'test-service', name: '测试服务', description: '用于测试密钥轮换的服务' },
    { id: 'payment-service', name: '支付服务', description: '处理支付交易的核心服务' },
    { id: 'internal-report', name: '内部报表服务', description: '生成内部报表的服务' }
  ];

  const consumers = [
    { id: 'consumer-test-1', service_id: 'test-service', name: '测试客户端A', environment: 'test' },
    { id: 'consumer-test-2', service_id: 'test-service', name: '测试客户端B', environment: 'test' },
    { id: 'consumer-test-3', service_id: 'test-service', name: '测试客户端C', environment: 'test' },
    { id: 'consumer-staging-1', service_id: 'payment-service', name: '支付网关预发', environment: 'staging' },
    { id: 'consumer-staging-2', service_id: 'payment-service', name: '支付SDK预发', environment: 'staging' },
    { id: 'consumer-prod-1', service_id: 'internal-report', name: '报表生成器生产', environment: 'production' },
    { id: 'consumer-prod-2', service_id: 'internal-report', name: '数据仓库生产', environment: 'production' },
    { id: 'consumer-prod-3', service_id: 'internal-report', name: 'ETL管道生产', environment: 'production' }
  ];

  services.forEach(service => {
    try {
      db.run(
        'INSERT INTO services (id, name, description) VALUES (?, ?, ?)',
        [service.id, service.name, service.description]
      );
    } catch (e) {
      // Ignore UNIQUE constraint errors
    }
  });

  consumers.forEach(consumer => {
    try {
      db.run(
        'INSERT INTO consumers (id, service_id, name, environment) VALUES (?, ?, ?, ?)',
        [consumer.id, consumer.service_id, consumer.name, consumer.environment]
      );
    } catch (e) {
      // Ignore UNIQUE constraint errors
    }
  });

  const initialKeys = [
    {
      id: 'initial-key-test-1',
      service_id: 'test-service',
      environment: 'test',
      version: '1',
      secret: 'test-service-initial-key-2024'
    },
    {
      id: 'initial-key-payment-staging-1',
      service_id: 'payment-service',
      environment: 'staging',
      version: '1',
      secret: 'payment-staging-initial-key-2024'
    },
    {
      id: 'initial-key-report-prod-5',
      service_id: 'internal-report',
      environment: 'production',
      version: '5',
      secret: 'report-prod-initial-key-v5-2024'
    }
  ];

  initialKeys.forEach(key => {
    try {
      db.run(
        'INSERT INTO key_versions (id, service_id, environment, version, secret_hash, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [key.id, key.service_id, key.environment, key.version, hashSecret(key.secret)]
      );
    } catch (e) {
      // Ignore UNIQUE constraint errors
    }
  });
}

function prepare(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      saveDatabase();
      return { lastInsertRowid: db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] };
    },
    get: function(...params) {
      const results = db.exec(sql, params);
      if (!results.length || !results[0].values.length) return null;
      const columns = results[0].columns;
      const values = results[0].values[0];
      const row = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      return row;
    },
    all: function(...params) {
      const results = db.exec(sql, params);
      if (!results.length) return [];
      const columns = results[0].columns;
      return results[0].values.map(values => {
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        return row;
      });
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDatabase();
}

function transaction(fn) {
  fn();
  saveDatabase();
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  transaction,
  saveDatabase
};
