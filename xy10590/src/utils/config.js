const path = require('path');
const fs = require('fs');

const WORKSPACE_DIR = process.cwd();
const BOUNCE_DIR = path.join(WORKSPACE_DIR, '.bounce');
const CONFIG_FILE = path.join(BOUNCE_DIR, 'config.json');
const DATA_DIR = path.join(BOUNCE_DIR, 'data');
const HISTORY_DIR = path.join(BOUNCE_DIR, 'history');
const EXPORT_DIR = path.join(WORKSPACE_DIR, 'exports');

const DATA_FILES = {
  send: path.join(DATA_DIR, 'send-logs.json'),
  bounce: path.join(DATA_DIR, 'bounces.json'),
  retry: path.join(DATA_DIR, 'retries.json'),
  source: path.join(DATA_DIR, 'sources.json'),
  attribution: path.join(DATA_DIR, 'attribution.json'),
  status: path.join(DATA_DIR, 'status.json'),
  unsubscribed: path.join(DATA_DIR, 'unsubscribed.json')
};

function isInitialized() {
  return fs.existsSync(BOUNCE_DIR) && fs.existsSync(CONFIG_FILE);
}

function ensureInitialized() {
  if (!isInitialized()) {
    throw new Error('工作目录未初始化，请先运行 "bounce init"');
  }
}

function getConfig() {
  ensureInitialized();
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getData(type) {
  const filePath = DATA_FILES[type];
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveData(type, data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILES[type], JSON.stringify(data, null, 2));
}

function getHistory(type, id) {
  const historyFile = path.join(HISTORY_DIR, `${type}-${id}.json`);
  if (!fs.existsSync(historyFile)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
}

function saveHistory(type, id, history) {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
  const historyFile = path.join(HISTORY_DIR, `${type}-${id}.json`);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

function addHistoryEntry(type, id, entry) {
  const history = getHistory(type, id);
  history.push({
    timestamp: new Date().toISOString(),
    ...entry
  });
  saveHistory(type, id, history);
}

function exportToFile(name, data, format = 'json') {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
  const filePath = path.join(EXPORT_DIR, `${name}.${format}`);
  if (format === 'json') {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } else if (format === 'csv') {
    fs.writeFileSync(filePath, data);
  }
  return filePath;
}

module.exports = {
  WORKSPACE_DIR,
  BOUNCE_DIR,
  CONFIG_FILE,
  DATA_DIR,
  HISTORY_DIR,
  EXPORT_DIR,
  DATA_FILES,
  isInitialized,
  ensureInitialized,
  getConfig,
  saveConfig,
  getData,
  saveData,
  getHistory,
  saveHistory,
  addHistoryEntry,
  exportToFile
};
