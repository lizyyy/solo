const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'fridge.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS donors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS food_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  unit TEXT DEFAULT '份'
);

CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER,
  donor_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT '份',
  expiry_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT,
  approved_at DATETIME,
  FOREIGN KEY (category_id) REFERENCES food_categories(id),
  FOREIGN KEY (donor_id) REFERENCES donors(id)
);

CREATE TABLE IF NOT EXISTS pickups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id INTEGER NOT NULL,
  resident_name TEXT NOT NULL,
  resident_phone TEXT,
  quantity INTEGER NOT NULL,
  pickup_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_by TEXT,
  FOREIGN KEY (food_id) REFERENCES foods(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  operator TEXT,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const categories = [
  { name: '蔬菜水果', unit: '斤' },
  { name: '米面粮油', unit: '袋' },
  { name: '熟食点心', unit: '份' },
  { name: '饮料零食', unit: '件' },
  { name: '调味品', unit: '瓶' }
];

const insertCat = db.prepare('INSERT OR IGNORE INTO food_categories (name, unit) VALUES (?, ?)');
for (const cat of categories) {
  insertCat.run(cat.name, cat.unit);
}

module.exports = db;
