const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/quotation.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      spec TEXT,
      unit TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currency TEXT NOT NULL UNIQUE,
      rate REAL NOT NULL,
      effective_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_no TEXT NOT NULL UNIQUE,
      supplier_id INTEGER NOT NULL,
      quotation_date DATE NOT NULL,
      currency TEXT NOT NULL,
      exchange_rate REAL,
      tax_rate REAL DEFAULT 0.13,
      status TEXT DEFAULT 'active',
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      price_tax_included REAL,
      price_tax_excluded REAL,
      tax_amount REAL,
      total_amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(quotation_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_quotations_supplier ON quotations(supplier_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_quotation_items_material ON quotation_items(material_id)`);

  const defaultRates = [
    { currency: 'CNY', rate: 1.0 },
    { currency: 'USD', rate: 7.2 },
    { currency: 'EUR', rate: 7.8 },
    { currency: 'GBP', rate: 9.1 },
    { currency: 'JPY', rate: 0.048 }
  ];

  defaultRates.forEach(rate => {
    db.run(`
      INSERT OR IGNORE INTO exchange_rates (currency, rate)
      VALUES (?, ?)
    `, [rate.currency, rate.rate]);
  });
});

module.exports = db;
