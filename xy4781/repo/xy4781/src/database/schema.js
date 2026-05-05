const { getDb, saveDatabase, runSql, getOne } = require('./connection');

const initSchema = () => {
  const db = getDb();

  const tables = [
    `CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_code TEXT NOT NULL UNIQUE,
      drug_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_no TEXT NOT NULL UNIQUE,
      patient_name TEXT NOT NULL,
      patient_id_card TEXT,
      status TEXT NOT NULL DEFAULT 'CREATED',
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      medical_insurance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      personal_payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      items TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS idempotency_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      action_type TEXT NOT NULL,
      resource_id INTEGER,
      response_data TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS fulfillments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fulfillment_no TEXT NOT NULL UNIQUE,
      prescription_id INTEGER NOT NULL,
      prescription_no TEXT NOT NULL,
      pharmacist_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      items TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS payment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT NOT NULL UNIQUE,
      fulfillment_id INTEGER NOT NULL,
      prescription_id INTEGER NOT NULL,
      prescription_no TEXT NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      medical_insurance_amount DECIMAL(10,2) NOT NULL,
      personal_payment_amount DECIMAL(10,2) NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      payment_time DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fulfillment_id) REFERENCES fulfillments(id),
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_id INTEGER NOT NULL,
      drug_code TEXT NOT NULL,
      drug_name TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      operation_desc TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      operator TEXT NOT NULL,
      request_ip TEXT,
      idempotency_key TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const tableSql of tables) {
    db.run(tableSql);
  }

  const tableExists = getOne("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory'");
  
  if (tableExists) {
    const countResult = getOne('SELECT COUNT(*) as count FROM inventory');
    
    if (countResult && countResult.count === 0) {
      const inventoryItems = [
        { code: 'DRUG001', name: '阿莫西林胶囊', qty: 100, price: 25.50 },
        { code: 'DRUG002', name: '布洛芬缓释胶囊', qty: 80, price: 18.00 },
        { code: 'DRUG003', name: '感冒灵颗粒', qty: 150, price: 12.00 },
        { code: 'DRUG004', name: '维生素C片', qty: 200, price: 8.50 },
        { code: 'DRUG005', name: '头孢克肟胶囊', qty: 50, price: 35.00 }
      ];

      for (const item of inventoryItems) {
        runSql(
          'INSERT INTO inventory (drug_code, drug_name, quantity, price) VALUES (?, ?, ?, ?)',
          [item.code, item.name, item.qty, item.price]
        );
      }
      console.log('初始化库存数据完成');
    }
  }

  saveDatabase();
  console.log('数据库模式初始化完成');
};

module.exports = initSchema;
