const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'canteen.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS elderly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      id_card TEXT UNIQUE,
      phone TEXT,
      address TEXT,
      dietary_restrictions TEXT,
      chronic_diseases TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      ingredients TEXT,
      allergens TEXT,
      nutrition_info TEXT,
      price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      breakfast_items TEXT,
      lunch_items TEXT,
      dinner_items TEXT,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS delivery_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      sequence TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elderly_id INTEGER,
      delivery_date DATE NOT NULL,
      meal_type TEXT NOT NULL,
      menu_items TEXT,
      route_id INTEGER,
      status TEXT DEFAULT 'pending',
      delivered_by TEXT,
      delivered_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (elderly_id) REFERENCES elderly(id),
      FOREIGN KEY (route_id) REFERENCES delivery_routes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS import_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_type TEXT NOT NULL,
      file_name TEXT,
      row_number INTEGER,
      original_data TEXT,
      error_message TEXT,
      suggestions TEXT,
      resolved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      operator TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_elderly_id_card ON elderly(id_card)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_import_errors_type ON import_errors(import_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_operation_history_date ON operation_history(created_at)`);
});

console.log('数据库初始化完成:', dbPath);
db.close();
