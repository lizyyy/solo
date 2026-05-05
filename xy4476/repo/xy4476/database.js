const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'podcast.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    website TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    publish_date DATE,
    recording_date DATE,
    status TEXT DEFAULT 'planned',
    inventory INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ad_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sponsor_id INTEGER NOT NULL,
    episode_id INTEGER NOT NULL,
    slot_type TEXT NOT NULL,
    position INTEGER,
    contract_id TEXT,
    is_broadcast INTEGER DEFAULT 0,
    is_fulfilled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id),
    FOREIGN KEY (episode_id) REFERENCES episodes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_number TEXT NOT NULL UNIQUE,
    sponsor_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    total_slots INTEGER NOT NULL,
    used_slots INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    exclusivity_category TEXT,
    max_frequency INTEGER DEFAULT 2,
    makegood_allowed INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id)
  )`);
});

module.exports = db;
