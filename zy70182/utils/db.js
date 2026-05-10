const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const DB_DIR = path.join(__dirname, '../database');
const DB_FILE = path.join(DB_DIR, 'data.json');

let db = null;

const DEFAULT_DATA = {
  suppliers: [],
  rebate_rules: [],
  rebate_tiers: [],
  sales_records: [],
  return_records: [],
  reconciliation_summaries: [],
  confirmation_letters: [],
  audit_logs: [],
  resource_locks: []
};

function ensureDBFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function loadDB() {
  ensureDBFile();
  if (!db) {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(data);
  }
  return db;
}

function saveDB() {
  if (db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
}

function resetDB() {
  db = JSON.parse(JSON.stringify(DEFAULT_DATA));
  saveDB();
}

function getDB() {
  return loadDB();
}

function generateId() {
  return uuidv4();
}

function now() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

function getPeriod(dateStr) {
  const date = moment(dateStr);
  return date.format('YYYY-MM');
}

class Table {
  constructor(name) {
    this.name = name;
  }

  get _data() {
    return getDB()[this.name];
  }

  _save() {
    saveDB();
  }

  findAll(filter = {}) {
    let results = [...this._data];
    
    for (const [key, value] of Object.entries(filter)) {
      results = results.filter(item => item[key] === value);
    }
    
    return results;
  }

  findOne(filter = {}) {
    return this._data.find(item => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }

  findById(id) {
    return this._data.find(item => item.id === id);
  }

  insert(data) {
    const record = { ...data };
    this._data.push(record);
    this._save();
    return record;
  }

  update(id, data) {
    const index = this._data.findIndex(item => item.id === id);
    if (index !== -1) {
      this._data[index] = { ...this._data[index], ...data };
      this._save();
      return this._data[index];
    }
    return null;
  }

  delete(id) {
    const index = this._data.findIndex(item => item.id === id);
    if (index !== -1) {
      const deleted = this._data.splice(index, 1)[0];
      this._save();
      return deleted;
    }
    return null;
  }

  deleteMany(filter = {}) {
    const toDelete = [];
    this._data = this._data.filter(item => {
      let shouldDelete = true;
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) {
          shouldDelete = false;
          break;
        }
      }
      if (shouldDelete) {
        toDelete.push(item);
      }
      return !shouldDelete;
    });
    this._save();
    return toDelete;
  }
}

function table(name) {
  return new Table(name);
}

module.exports = {
  getDB,
  generateId,
  now,
  getPeriod,
  table,
  resetDB,
  loadDB,
  saveDB
};
