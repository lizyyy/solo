const db = require('../config/database');

const initDatabase = () => {
  db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS class_transfer_audit`);
    db.run(`DROP TABLE IF EXISTS class_transfers`);
    db.run(`DROP TABLE IF EXISTS members`);
    db.run(`DROP TABLE IF EXISTS coaches`);
    db.run(`DROP TABLE IF EXISTS stores`);

    db.run(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        store_address TEXT,
        store_phone TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS coaches (
        id TEXT PRIMARY KEY,
        coach_name TEXT NOT NULL,
        phone TEXT,
        store_id TEXT NOT NULL,
        specialization TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        member_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        member_level TEXT DEFAULT '普通会员',
        store_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS class_transfers (
        id TEXT PRIMARY KEY,
        transfer_no TEXT UNIQUE NOT NULL,
        transfer_date TEXT NOT NULL,
        store_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        assignor_id TEXT NOT NULL,
        assignor_name TEXT NOT NULL,
        assignor_phone TEXT NOT NULL,
        assignee_id TEXT NOT NULL,
        assignee_name TEXT NOT NULL,
        assignee_phone TEXT NOT NULL,
        coach_id TEXT NOT NULL,
        coach_name TEXT NOT NULL,
        class_package_id TEXT NOT NULL,
        class_package_name TEXT NOT NULL,
        transfer_class_count INTEGER NOT NULL,
        remaining_class_count INTEGER NOT NULL,
        original_unit_price REAL NOT NULL,
        transfer_fee REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        scheduled_class_time TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        handler_id TEXT,
        handler_name TEXT,
        approved_at TEXT,
        reject_reason TEXT,
        remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS class_transfer_audit (
        id TEXT PRIMARY KEY,
        transfer_id TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        operator_id TEXT,
        operator_name TEXT,
        operation_remark TEXT,
        operated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transfer_id) REFERENCES class_transfers(id)
      )
    `);

    const insertSampleData = require('./sampleData');
    insertSampleData(db);
  });
};

initDatabase();
