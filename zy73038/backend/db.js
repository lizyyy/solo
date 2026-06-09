const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_DB = {
  reports: [],
  materials: [],
  medications: [],
  histories: [],
  anomalies: [],
  seq: { reports: 0, materials: 0, medications: 0, histories: 0, anomalies: 0 }
};

let cache = null;

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DB_FILE)) {
    save(JSON.parse(JSON.stringify(DEFAULT_DB)));
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return cache;
  } catch (e) {
    cache = JSON.parse(JSON.stringify(DEFAULT_DB));
    return cache;
  }
}

function save(db) {
  cache = db;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function tx(fn) {
  const db = load();
  const r = fn(db);
  save(db);
  return r;
}

function now() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function insert(db, table, obj) {
  const id = (db.seq[table] || 0) + 1;
  db.seq[table] = id;
  const row = { id, created_at: now(), ...obj };
  db[table].push(row);
  return row;
}

function findAll(db, table, predicate = () => true, sortBy = null) {
  const rows = db[table].filter(predicate);
  if (sortBy) rows.sort(sortBy);
  return rows;
}

function findOne(db, table, predicate) {
  return db[table].find(predicate);
}

function update(db, table, predicate, patch) {
  let n = 0;
  db[table].forEach(row => {
    if (predicate(row)) { Object.assign(row, patch); n++; }
  });
  return n;
}

module.exports = { load, save, tx, now, insert, findAll, findOne, update };
