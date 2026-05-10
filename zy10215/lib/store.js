const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILES = {
  recipes: 'recipes.json',
  orders: 'orders.json',
  inventory: 'inventory.json',
  substitutes: 'substitutes.json',
  losses: 'losses.json',
  batches: 'batches.json',
  importLogs: 'import-logs.json',
  lastValidate: 'last-validate.json'
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function fileExists(dir, fileKey) {
  return fs.existsSync(path.join(dir, DATA_FILES[fileKey]));
}

function readJson(dir, fileKey, defaultValue) {
  const filePath = path.join(dir, DATA_FILES[fileKey]);
  if (!fs.existsSync(filePath)) {
    return defaultValue || [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content || '[]');
}

function writeJson(dir, fileKey, data) {
  ensureDir(dir);
  const filePath = path.join(dir, DATA_FILES[fileKey]);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function hashData(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function generateId(prefix = '') {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${date}-${random}`;
}

function getBatchNumber(dir, date = null) {
  const batches = readJson(dir, 'batches', []);
  const targetDate = date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayBatches = batches.filter(b => b.batchNo.startsWith(`B${targetDate}-`));
  const num = todayBatches.length + 1;
  return `B${targetDate}-${String(num).padStart(3, '0')}`;
}

module.exports = {
  DATA_FILES,
  ensureDir,
  fileExists,
  readJson,
  writeJson,
  hashData,
  generateId,
  getBatchNumber
};
