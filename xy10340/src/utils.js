
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const STORAGE_FILE = path.join(DATA_DIR, 'storage.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStorage() {
  ensureDataDir();
  if (!fs.existsSync(STORAGE_FILE)) {
    return {
      vehicles: [],
      packages: [],
      packageRights: [],
      verificationRecords: [],
      shops: []
    };
  }
  return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
}

function saveStorage(data) {
  ensureDataDir();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function formatMoney(amount) {
  return `¥${amount.toFixed(2)}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const typeColors = {
    info: '\x1b[36m%s\x1b[0m',
    success: '\x1b[32m%s\x1b[0m',
    warning: '\x1b[33m%s\x1b[0m',
    error: '\x1b[31m%s\x1b[0m'
  };
  const color = typeColors[type] || typeColors.info;
  console.log(color, `[${timestamp}] ${message}`);
}

module.exports = {
  loadStorage,
  saveStorage,
  formatDate,
  formatMoney,
  generateId,
  log,
  ensureDataDir
};
