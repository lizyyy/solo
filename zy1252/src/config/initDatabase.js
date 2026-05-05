const { exec, run } = require('./database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const initTables = async () => {
  try {
    console.log('正在初始化数据库表...');

    await exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        gateway_transaction_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    await exec(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        request_path TEXT NOT NULL,
        request_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        response_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    await exec(`
      CREATE TABLE IF NOT EXISTS request_fingerprints (
        id TEXT PRIMARY KEY,
        idempotency_key_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL UNIQUE,
        request_body_hash TEXT,
        request_params_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idempotency_key_id) REFERENCES idempotency_keys(id)
      )
    `);

    await exec(`
      CREATE TABLE IF NOT EXISTS callback_events (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        transaction_id TEXT,
        callback_type TEXT NOT NULL,
        callback_data TEXT,
        status TEXT NOT NULL DEFAULT 'received',
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try { await run('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)'); } catch(e) {}
    try { await run('CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id)'); } catch(e) {}
    try { await run('CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(key)'); } catch(e) {}
    try { await run('CREATE INDEX IF NOT EXISTS idx_callback_events_order_id ON callback_events(order_id)'); } catch(e) {}
    try { await run('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)'); } catch(e) {}

    console.log('数据库表初始化成功');
  } catch (error) {
    console.error('数据库表初始化失败:', error.message);
    throw error;
  }
};

const dropTables = async () => {
  try {
    console.log('正在删除所有表...');
    
    await exec('DROP TABLE IF EXISTS audit_logs');
    await exec('DROP TABLE IF EXISTS callback_events');
    await exec('DROP TABLE IF EXISTS request_fingerprints');
    await exec('DROP TABLE IF EXISTS idempotency_keys');
    await exec('DROP TABLE IF EXISTS payment_transactions');
    await exec('DROP TABLE IF EXISTS orders');
    
    console.log('数据库表删除成功');
  } catch (error) {
    console.error('数据库表删除失败:', error.message);
    throw error;
  }
};

module.exports = {
  initTables,
  dropTables
};
