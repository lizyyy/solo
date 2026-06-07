const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      desensitizationRules: [],
      grayBatches: [],
      inspectionRecords: [],
      exportResults: [],
      auditLogs: [],
      phoneMaskIssues: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveStore(store) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

module.exports = {
  loadStore,
  saveStore,
  generateId
};
