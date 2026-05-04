const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'food_safety.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('连接到 SQLite 数据库');
  }
});

const initDB = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS stalls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        contact_person TEXT,
        phone TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stall_id INTEGER,
        name TEXT NOT NULL,
        allergens TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (stall_id) REFERENCES stalls (id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        stall_id INTEGER,
        dish_id INTEGER,
        quantity INTEGER DEFAULT 1,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (stall_id) REFERENCES stalls (id),
        FOREIGN KEY (dish_id) REFERENCES dishes (id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS ingredient_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        supplier TEXT,
        expiration_date TEXT,
        quantity TEXT,
        unit TEXT,
        received_date TEXT,
        dish_id INTEGER,
        menu_id INTEGER,
        stall_id INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (dish_id) REFERENCES dishes (id),
        FOREIGN KEY (menu_id) REFERENCES menus (id),
        FOREIGN KEY (stall_id) REFERENCES stalls (id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS temperature_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_id INTEGER,
        dish_id INTEGER,
        stall_id INTEGER,
        temperature REAL NOT NULL,
        record_time TEXT NOT NULL,
        record_type TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (menu_id) REFERENCES menus (id),
        FOREIGN KEY (dish_id) REFERENCES dishes (id),
        FOREIGN KEY (stall_id) REFERENCES stalls (id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_id INTEGER,
        dish_id INTEGER,
        stall_id INTEGER,
        sample_time TEXT NOT NULL,
        sample_weight TEXT,
        photo_path TEXT,
        photo_data TEXT,
        keeper TEXT,
        location TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (menu_id) REFERENCES menus (id),
        FOREIGN KEY (dish_id) REFERENCES dishes (id),
        FOREIGN KEY (stall_id) REFERENCES stalls (id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_id INTEGER,
        stall_id INTEGER,
        dish_id INTEGER,
        allergen_status TEXT DEFAULT 'pending',
        sample_status TEXT DEFAULT 'pending',
        cooling_status TEXT DEFAULT 'pending',
        batch_status TEXT DEFAULT 'pending',
        overall_status TEXT DEFAULT 'pending',
        reviewer TEXT,
        review_time TEXT DEFAULT (datetime('now', 'localtime')),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (menu_id) REFERENCES menus (id),
        FOREIGN KEY (dish_id) REFERENCES dishes (id),
        FOREIGN KEY (stall_id) REFERENCES stalls (id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS risk_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        stall_id INTEGER,
        dish_id INTEGER,
        menu_id INTEGER,
        risk_type TEXT NOT NULL,
        risk_level TEXT DEFAULT 'medium',
        description TEXT,
        suggestion TEXT,
        status TEXT DEFAULT 'open',
        handler TEXT,
        handle_time TEXT,
        handle_notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (menu_id) REFERENCES menus (id),
        FOREIGN KEY (dish_id) REFERENCES dishes (id),
        FOREIGN KEY (stall_id) REFERENCES stalls (id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_menus_date ON menus (date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_menus_stall ON menus (stall_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_menu ON reviews (menu_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_risk_date ON risk_records (date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_risk_stall ON risk_records (stall_id)`);

      resolve();
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

module.exports = {
  db,
  initDB,
  run,
  get,
  all
};
