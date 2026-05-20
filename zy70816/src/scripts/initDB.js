const db = require('../config/database');

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_code TEXT UNIQUE NOT NULL,
        store_name TEXT NOT NULL,
        address TEXT,
        contact_person TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_code TEXT UNIQUE NOT NULL,
        supplier_name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_code TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        category TEXT,
        specification TEXT,
        unit TEXT,
        price REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        product_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        production_date DATE,
        expiry_date DATE,
        quantity INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        is_frozen INTEGER DEFAULT 0,
        frozen_reason TEXT,
        frozen_by TEXT,
        frozen_at DATETIME,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        store_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        warehouse_location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (store_id) REFERENCES stores(id),
        UNIQUE(batch_id, store_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS recalls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recall_no TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        batch_nos TEXT,
        reason TEXT,
        level TEXT DEFAULT 'general',
        published_date DATE,
        publisher TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS consumption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        batch_id INTEGER NOT NULL,
        consumption_date DATE NOT NULL,
        quantity INTEGER NOT NULL,
        used_by TEXT,
        patient_info TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        handler TEXT NOT NULL,
        notes TEXT,
        previous_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_no TEXT UNIQUE NOT NULL,
        batch_id INTEGER NOT NULL,
        from_store_id INTEGER NOT NULL,
        to_store_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        confirmed_by TEXT,
        confirmed_at DATETIME,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (from_store_id) REFERENCES stores(id),
        FOREIGN KEY (to_store_id) REFERENCES stores(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS substitute_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_batch_id INTEGER NOT NULL,
        substitute_batch_id INTEGER NOT NULL,
        reason TEXT,
        handled_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (original_batch_id) REFERENCES batches(id),
        FOREIGN KEY (substitute_batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS store_confirmations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        store_id INTEGER NOT NULL,
        confirmation_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        confirmed_by TEXT,
        confirmed_at DATETIME,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (store_id) REFERENCES stores(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT NOT NULL,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

createTables()
  .then(() => {
    console.log('数据库表创建成功');
    db.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('数据库表创建失败:', err);
    db.close();
    process.exit(1);
  });
