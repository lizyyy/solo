const path = require('path');
const { PENDING_DIR, CONFIRMED_DIR, loadJson, saveJson } = require('./utils');

const FILES = {
  specs: 'specs.json',
  courses: 'courses.json',
  inventory: 'inventory.json',
  transactions: 'transactions.json',
  importBatches: 'import_batches.json',
  anomalies: 'anomalies.json'
};

function getPath(store, type) {
  const dir = store === 'pending' ? PENDING_DIR : CONFIRMED_DIR;
  return path.join(dir, FILES[type]);
}

function getSpecs(store = 'pending') {
  return loadJson(getPath(store, 'specs'), []);
}

function saveSpecs(store, data) {
  saveJson(getPath(store, 'specs'), data);
}

function getCourses(store = 'pending') {
  return loadJson(getPath(store, 'courses'), []);
}

function saveCourses(store, data) {
  saveJson(getPath(store, 'courses'), data);
}

function getInventory(store = 'pending') {
  return loadJson(getPath(store, 'inventory'), []);
}

function saveInventory(store, data) {
  saveJson(getPath(store, 'inventory'), data);
}

function getTransactions(store = 'pending') {
  return loadJson(getPath(store, 'transactions'), []);
}

function saveTransactions(store, data) {
  saveJson(getPath(store, 'transactions'), data);
}

function getImportBatches(store = 'pending') {
  return loadJson(getPath(store, 'importBatches'), []);
}

function saveImportBatches(store, data) {
  saveJson(getPath(store, 'importBatches'), data);
}

function getAnomalies(store = 'pending') {
  return loadJson(getPath(store, 'anomalies'), []);
}

function saveAnomalies(store, data) {
  saveJson(getPath(store, 'anomalies'), data);
}

function getSpecById(store, specId) {
  const specs = getSpecs(store);
  return specs.find(s => s.id === specId);
}

function getCourseById(store, courseId) {
  const courses = getCourses(store);
  return courses.find(c => c.id === courseId);
}

function getInventoryBySpec(store, specId) {
  const inventory = getInventory(store);
  return inventory.find(i => i.specId === specId) || { specId, quantity: 0 };
}

function computeCurrentInventory(store = 'pending') {
  const specs = getSpecs(store);
  const transactions = getTransactions(store);
  const confirmed = transactions.filter(t => t.status === 'confirmed');

  const inventoryMap = {};
  specs.forEach(s => {
    inventoryMap[s.id] = 0;
  });

  confirmed.forEach(t => {
    if (!inventoryMap[t.specId]) inventoryMap[t.specId] = 0;
    inventoryMap[t.specId] += t.quantity;
  });

  return specs.map(s => ({
    specId: s.id,
    specName: s.name,
    unit: s.unit,
    quantity: inventoryMap[s.id] || 0
  }));
}

function getTransactionsByStudent(store, studentIdOrName) {
  const transactions = getTransactions(store);
  return transactions.filter(
    t => t.studentId === studentIdOrName || t.studentName === studentIdOrName
  );
}

module.exports = {
  getSpecs,
  saveSpecs,
  getCourses,
  saveCourses,
  getInventory,
  saveInventory,
  getTransactions,
  saveTransactions,
  getImportBatches,
  saveImportBatches,
  getAnomalies,
  saveAnomalies,
  getSpecById,
  getCourseById,
  getInventoryBySpec,
  computeCurrentInventory,
  getTransactionsByStudent
};
