const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const initialState = {
  students: [],
  feeItems: [],
  deductionRules: [],
  studentDeductions: [],
  arrearRecords: [],
  installmentPlans: [],
  approvalProcesses: [],
  paymentRecords: [],
  reconciliationRecords: [],
  failedTasks: [],
  idCounters: {
    students: 1001,
    feeItems: 2001,
    deductionRules: 3001,
    studentDeductions: 4001,
    arrearRecords: 5001,
    installmentPlans: 6001,
    approvalProcesses: 7001,
    paymentRecords: 8001,
    reconciliationRecords: 9001,
    failedTasks: 10001
  }
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    saveData(initialState);
    return JSON.parse(JSON.stringify(initialState));
  }
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(content);
}

function saveData(state) {
  ensureDataDir();
  const content = JSON.stringify(state, null, 2);
  fs.writeFileSync(DATA_FILE, content, 'utf-8');
}

function getNextId(collectionName) {
  const state = loadData();
  const id = state.idCounters[collectionName];
  state.idCounters[collectionName] = id + 1;
  return { id, updatedState: state };
}

function findAll(collectionName) {
  const state = loadData();
  return state[collectionName] || [];
}

function findById(collectionName, id) {
  const state = loadData();
  const collection = state[collectionName] || [];
  return collection.find(item => item.id === id) || null;
}

function findOne(collectionName, predicate) {
  const state = loadData();
  const collection = state[collectionName] || [];
  return collection.find(predicate) || null;
}

function findMany(collectionName, predicate) {
  const state = loadData();
  const collection = state[collectionName] || [];
  if (!predicate) return collection;
  return collection.filter(predicate);
}

function insert(collectionName, item) {
  let state;
  if (!item.id) {
    const result = getNextId(collectionName);
    item.id = result.id;
    state = result.updatedState;
  } else {
    state = loadData();
  }
  item.createdAt = new Date().toISOString();
  item.updatedAt = new Date().toISOString();
  if (!state[collectionName]) {
    state[collectionName] = [];
  }
  state[collectionName].push(item);
  saveData(state);
  return item;
}

function update(collectionName, id, updates) {
  const state = loadData();
  const collection = state[collectionName] || [];
  const index = collection.findIndex(item => item.id === id);
  if (index === -1) return null;
  collection[index] = {
    ...collection[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveData(state);
  return collection[index];
}

function remove(collectionName, id) {
  const state = loadData();
  const collection = state[collectionName] || [];
  const index = collection.findIndex(item => item.id === id);
  if (index === -1) return false;
  collection.splice(index, 1);
  saveData(state);
  return true;
}

function reset() {
  saveData(JSON.parse(JSON.stringify(initialState)));
}

module.exports = {
  loadData,
  saveData,
  getNextId,
  findAll,
  findById,
  findOne,
  findMany,
  insert,
  update,
  remove,
  reset
};
