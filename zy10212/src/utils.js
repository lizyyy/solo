const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PENDING_DIR = path.join(DATA_DIR, 'pending');
const CONFIRMED_DIR = path.join(DATA_DIR, 'confirmed');

function ensureDirs() {
  [DATA_DIR, PENDING_DIR, CONFIRMED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function loadJson(filePath, defaultVal = []) {
  if (!fs.existsSync(filePath)) {
    return defaultVal;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) {
    return defaultVal;
  }
  return JSON.parse(content);
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function generateId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function now() {
  return Date.now();
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function logSuccess(msg) {
  console.log(`✅ ${msg}`);
}

function logWarn(msg) {
  console.log(`⚠️  ${msg}`);
}

function logError(msg) {
  console.log(`❌ ${msg}`);
}

function logInfo(msg) {
  console.log(`ℹ️  ${msg}`);
}

module.exports = {
  DATA_DIR,
  PENDING_DIR,
  CONFIRMED_DIR,
  ensureDirs,
  loadJson,
  saveJson,
  generateId,
  now,
  parseDate,
  formatDate,
  logSuccess,
  logWarn,
  logError,
  logInfo
};
