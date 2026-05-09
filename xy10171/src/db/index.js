const { JSONFile, Low } = require('lowdb');
const path = require('path');

let db;
let dbAdapter;

const DEFAULT_DATA = {
  idempotency_keys: [],
  inventories: [],
  inventory_reservations: [],
  exchanges: [],
  exchange_status_logs: []
};

async function initDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../db.json');
  const adapter = new JSONFile(dbPath);
  dbAdapter = new Low(adapter);
  
  await dbAdapter.read();
  
  if (!dbAdapter.data) {
    dbAdapter.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    await dbAdapter.write();
  }
  
  for (const key of Object.keys(DEFAULT_DATA)) {
    if (!dbAdapter.data[key]) {
      dbAdapter.data[key] = [];
    }
  }
  
  await dbAdapter.write();
  db = dbAdapter.data;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

async function persist() {
  if (dbAdapter) {
    await dbAdapter.write();
  }
}

function resetDb() {
  const newData = JSON.parse(JSON.stringify(DEFAULT_DATA));
  if (dbAdapter) {
    dbAdapter.data = newData;
  }
  db = newData;
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
