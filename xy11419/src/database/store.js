const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const dataPath = path.join(dataDir, 'store.json');

let store = {
  batches: [],
  work_orders: [],
  status_transitions: [],
  evidences: [],
  materials: [],
  async_tasks: [],
  audit_logs: [],
  users: []
};

function load() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (fs.existsSync(dataPath)) {
    try {
      store = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
      console.log('数据文件损坏，使用空存储');
    }
  }
}

function save() {
  fs.writeFileSync(dataPath, JSON.stringify(store, null, 2), 'utf8');
}

function reset() {
  store = {
    batches: [],
    work_orders: [],
    status_transitions: [],
    evidences: [],
    materials: [],
    async_tasks: [],
    audit_logs: [],
    users: []
  };
  save();
}

function insert(table, record) {
  if (!store[table]) store[table] = [];
  store[table].push(record);
  save();
  return record;
}

function findAll(table, filter = {}) {
  let results = store[table] || [];
  Object.keys(filter).forEach(key => {
    results = results.filter(r => r[key] === filter[key]);
  });
  return results;
}

function findOne(table, filter) {
  return findAll(table, filter)[0] || null;
}

function findById(table, id) {
  return (store[table] || []).find(r => r.id === id) || null;
}

function update(table, id, updates) {
  const arr = store[table] || [];
  const idx = arr.findIndex(r => r.id === id);
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...updates };
    save();
    return arr[idx];
  }
  return null;
}

function remove(table, id) {
  const arr = store[table] || [];
  const idx = arr.findIndex(r => r.id === id);
  if (idx >= 0) {
    arr.splice(idx, 1);
    save();
    return true;
  }
  return false;
}

function query(table, predicate) {
  return (store[table] || []).filter(predicate);
}

load();

module.exports = {
  store,
  insert,
  findAll,
  findOne,
  findById,
  update,
  remove,
  query,
  reset,
  save
};
