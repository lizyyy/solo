const fs = require('fs');
const path = require('path');

let db = null;
let dbPath = null;
let dbDirty = false;

const DEFAULT_DATA = {
  idempotency_keys: [],
  inventories: [],
  inventory_reservations: [],
  exchanges: [],
  exchange_status_logs: []
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function persistSync() {
  if (db && dbPath && dbPath !== ':memory:') {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
      dbDirty = false;
    } catch (e) {
      console.error('Failed to persist db:', e.message);
    }
  }
}

function schedulePersist() {
  if (dbPath && dbPath !== ':memory:' && !dbDirty) {
    dbDirty = true;
    process.nextTick(persistSync);
  }
}

function initDb() {
  dbPath = process.env.DB_PATH || path.join(__dirname, '../../db.json');
  
  if (dbPath === ':memory:') {
    db = clone(DEFAULT_DATA);
    return;
  }
  
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(content);
    } catch (e) {
      console.warn('Failed to read db file, initializing new:', e.message);
      db = clone(DEFAULT_DATA);
    }
  } else {
    db = clone(DEFAULT_DATA);
  }
  
  for (const key of Object.keys(DEFAULT_DATA)) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
    }
  }
  
  persistSync();
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function persist() {
  persistSync();
}

function resetDb() {
  db = clone(DEFAULT_DATA);
  if (dbPath !== ':memory:') {
    persistSync();
  }
}

function query(collectionName, filterFn = null) {
  const collection = getDb()[collectionName] || [];
  if (!filterFn) {
    return collection.map(item => clone(item));
  }
  return collection.filter(filterFn).map(item => clone(item));
}

function queryOne(collectionName, filterFn) {
  const collection = getDb()[collectionName] || [];
  const found = collection.find(filterFn);
  return found ? clone(found) : null;
}

function insert(collectionName, record) {
  const collection = getDb()[collectionName];
  if (!collection) {
    throw new Error(`Collection not found: ${collectionName}`);
  }
  const newRecord = clone(record);
  collection.push(newRecord);
  schedulePersist();
  return newRecord;
}

function update(collectionName, filterFn, updates) {
  const collection = getDb()[collectionName];
  if (!collection) {
    throw new Error(`Collection not found: ${collectionName}`);
  }
  const index = collection.findIndex(filterFn);
  if (index === -1) {
    return null;
  }
  const updated = { ...collection[index], ...updates };
  collection[index] = clone(updated);
  schedulePersist();
  return clone(collection[index]);
}

function remove(collectionName, filterFn) {
  const collection = getDb()[collectionName];
  if (!collection) {
    throw new Error(`Collection not found: ${collectionName}`);
  }
  const lengthBefore = collection.length;
  db[collectionName] = collection.filter(item => !filterFn(item));
  schedulePersist();
  return lengthBefore - db[collectionName].length;
}

function transaction(fn) {
  const snapshot = JSON.stringify(db);
  try {
    fn();
    schedulePersist();
    return true;
  } catch (error) {
    const prevData = JSON.parse(snapshot);
    Object.assign(db, prevData);
    throw error;
  }
}

function asyncTransaction(fn) {
  const snapshot = JSON.stringify(db);
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(r => {
        schedulePersist();
        return r;
      }).catch(err => {
        const prevData = JSON.parse(snapshot);
        Object.assign(db, prevData);
        throw err;
      });
    }
    schedulePersist();
    return result;
  } catch (error) {
    const prevData = JSON.parse(snapshot);
    Object.assign(db, prevData);
    throw error;
  }
}

module.exports = {
  initDb,
  getDb,
  persist,
  resetDb,
  query,
  queryOne,
  insert,
  update,
  remove,
  transaction,
  asyncTransaction
};
