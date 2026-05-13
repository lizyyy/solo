const path = require('path');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

let db;
let dbAdapter;

const DEFAULT_DATA = {
  idempotency_keys: [],
  inventories: [],
  inventory_reservations: [],
  exchanges: [],
  exchange_status_logs: []
};

function initDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../db.json');
  const adapter = new FileSync(dbPath);
  dbAdapter = low(adapter);
  
  for (const key of Object.keys(DEFAULT_DATA)) {
    if (!dbAdapter.has(key).value()) {
      dbAdapter.set(key, []).write();
    }
  }
  
  dbAdapter.defaults(DEFAULT_DATA).write();
  db = dbAdapter.value();
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function persist() {
  if (dbAdapter) {
    dbAdapter.write();
  }
}

function resetDb() {
  if (dbAdapter) {
    for (const key of Object.keys(DEFAULT_DATA)) {
      dbAdapter.set(key, []).write();
    }
    db = dbAdapter.value();
  }
}

function query(collectionName, filterFn = null) {
  const collection = getDb()[collectionName] || [];
  if (!filterFn) {
    return [...collection];
  }
  return collection.filter(filterFn);
}

function queryOne(collectionName, filterFn) {
  const collection = getDb()[collectionName] || [];
  return collection.find(filterFn) || null;
}

function insert(collectionName, record) {
  const collection = getDb()[collectionName];
  const newRecord = { ...record };
  collection.push(newRecord);
  return newRecord;
}

function update(collectionName, filterFn, updates) {
  const collection = getDb()[collectionName];
  const index = collection.findIndex(filterFn);
  if (index === -1) {
    return null;
  }
  collection[index] = { ...collection[index], ...updates };
  return collection[index];
}

function remove(collectionName, filterFn) {
  const collection = getDb()[collectionName];
  const lengthBefore = collection.length;
  db[collectionName] = collection.filter(item => !filterFn(item));
  return lengthBefore - db[collectionName].length;
}

function transaction(fn) {
  const snapshot = JSON.stringify(db);
  try {
    fn();
    return true;
  } catch (error) {
    const prevData = JSON.parse(snapshot);
    Object.assign(db, prevData);
    throw error;
  }
}

async function asyncTransaction(fn) {
  const snapshot = JSON.stringify(db);
  try {
    const result = await fn();
    await persist();
    return result;
  } catch (error) {
    const prevData = JSON.parse(snapshot);
    Object.assign(db, prevData);
    await persist();
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
