const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'book_tracker.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn TEXT,
      title TEXT NOT NULL,
      author TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      current_location_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_location_id) REFERENCES locations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS book_tags (
      book_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (book_id, tag_id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS residents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS borrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      resident_id INTEGER NOT NULL,
      borrow_location_id INTEGER NOT NULL,
      borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_return_date DATETIME,
      actual_return_date DATETIME,
      return_location_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (resident_id) REFERENCES residents(id),
      FOREIGN KEY (borrow_location_id) REFERENCES locations(id),
      FOREIGN KEY (return_location_id) REFERENCES locations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS flow_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      from_location_id INTEGER,
      to_location_id INTEGER,
      resident_id INTEGER,
      borrow_record_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (from_location_id) REFERENCES locations(id),
      FOREIGN KEY (to_location_id) REFERENCES locations(id),
      FOREIGN KEY (resident_id) REFERENCES residents(id),
      FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS compensations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      resident_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (resident_id) REFERENCES residents(id)
    )`);
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync
};
