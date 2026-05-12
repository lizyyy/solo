const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, '../../data');
const dataFile = path.join(dataDir, 'data.json');

const tables = ['orders', 'order_items', 'documents', 'tax_codes', 'checkpoints', 'supplements', 'status_history', 'manual_corrections'];

let data = {
  orders: [],
  order_items: [],
  documents: [],
  tax_codes: [],
  checkpoints: [],
  supplements: [],
  status_history: [],
  manual_corrections: []
};

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  if (fs.existsSync(dataFile)) {
    try {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      const parsed = JSON.parse(raw);
      data = { ...data, ...parsed };
    } catch (e) {
      console.warn('数据文件损坏，使用空数据', e.message);
    }
  }
}

function saveData() {
  ensureDataDir();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
}

function findOne(tableName, predicate) {
  return data[tableName]?.find(predicate);
}

function findMany(tableName, predicate) {
  if (!predicate) return [...(data[tableName] || [])];
  return data[tableName]?.filter(predicate) || [];
}

function insert(tableName, record) {
  if (!data[tableName]) data[tableName] = [];
  const newRecord = { ...record };
  if (!newRecord.id) newRecord.id = uuidv4();
  data[tableName].push(newRecord);
  saveData();
  return newRecord;
}

function insertMany(tableName, records) {
  return records.map(r => insert(tableName, r));
}

function update(tableName, predicate, updates) {
  if (!data[tableName]) return 0;
  let count = 0;
  data[tableName] = data[tableName].map(record => {
    if (predicate(record)) {
      count++;
      return { ...record, ...updates };
    }
    return record;
  });
  if (count > 0) saveData();
  return count;
}

function remove(tableName, predicate) {
  if (!data[tableName]) return 0;
  const originalLength = data[tableName].length;
  if (!predicate) {
    data[tableName] = [];
  } else {
    data[tableName] = data[tableName].filter(r => !predicate(r));
  }
  const count = originalLength - data[tableName].length;
  if (count > 0) saveData();
  return count;
}

function clearAll() {
  tables.forEach(t => {
    data[t] = [];
  });
  saveData();
}

loadData();

module.exports = {
  findOne,
  findMany,
  insert,
  insertMany,
  update,
  remove,
  clearAll,
  tables
};
