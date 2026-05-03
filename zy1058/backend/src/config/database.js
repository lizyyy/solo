const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kiln_system.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到SQLite数据库:', dbPath);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS clays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        temp_min INTEGER,
        temp_max INTEGER,
        cone TEXT,
        color TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS glazes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        temp_min INTEGER,
        temp_max INTEGER,
        cone TEXT,
        color TEXT,
        compatible_clays TEXT,
        incompatible_glazes TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS kilns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        max_temperature INTEGER,
        width INTEGER,
        height INTEGER,
        depth INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS shelves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kiln_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        level INTEGER,
        width INTEGER,
        height INTEGER,
        depth INTEGER,
        max_weight REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kiln_id) REFERENCES kilns (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS firing_curves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        cone TEXT,
        max_temperature INTEGER,
        description TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS artworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        customer_id INTEGER,
        clay_id INTEGER,
        glaze_id INTEGER,
        glaze2_id INTEGER,
        width REAL,
        height REAL,
        depth REAL,
        weight REAL,
        delivery_date DATE,
        status TEXT DEFAULT 'pending',
        current_firing_task_id INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id),
        FOREIGN KEY (clay_id) REFERENCES clays (id),
        FOREIGN KEY (glaze_id) REFERENCES glazes (id),
        FOREIGN KEY (glaze2_id) REFERENCES glazes (id),
        FOREIGN KEY (current_firing_task_id) REFERENCES firing_tasks (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS firing_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kiln_id INTEGER,
        firing_curve_id INTEGER,
        status TEXT DEFAULT 'planning',
        scheduled_start DATETIME,
        actual_start DATETIME,
        actual_end DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kiln_id) REFERENCES kilns (id),
        FOREIGN KEY (firing_curve_id) REFERENCES firing_curves (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS task_artworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        artwork_id INTEGER NOT NULL,
        shelf_id INTEGER,
        position_x REAL,
        position_y REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES firing_tasks (id),
        FOREIGN KEY (artwork_id) REFERENCES artworks (id),
        FOREIGN KEY (shelf_id) REFERENCES shelves (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artwork_id INTEGER NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (artwork_id) REFERENCES artworks (id)
      )
    `);

    const sampleData = require('../data/sampleData');
    sampleData.initializeSampleData(db);
  });
}

module.exports = db;
