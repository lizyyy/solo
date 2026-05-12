const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = '.cold-chain';
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const HISTORY_DIR = path.join(WORKSPACE_DIR, 'history');
const CONFIG_FILE = path.join(WORKSPACE_DIR, 'config.json');

const getWorkspaceStatus = () => {
  const initialized = fs.existsSync(WORKSPACE_DIR);
  const hasData = initialized && fs.existsSync(DATA_DIR);
  return {
    initialized,
    hasData,
    configPath: CONFIG_FILE,
    dataPath: DATA_DIR,
    historyPath: HISTORY_DIR
  };
};

const ensureDirs = () => {
  if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR);
  
  const dataSubdirs = ['temperature', 'door', 'maintenance', 'batch', 'alerts', 'assessments'];
  dataSubdirs.forEach(dir => {
    const dirPath = path.join(DATA_DIR, dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
  });
};

const readJSON = (filePath, defaultValue = []) => {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
};

const writeJSON = (filePath, data) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

const getDataPath = (type, id = null) => {
  const dir = path.join(DATA_DIR, type);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return id ? path.join(dir, `${id}.json`) : dir;
};

const getHistoryPath = (type, id) => {
  const dir = path.join(HISTORY_DIR, type);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${id}-${Date.now()}.json`);
};

const saveHistory = (type, id, data, changeType, operator = 'system') => {
  const historyPath = getHistoryPath(type, id);
  const historyEntry = {
    id,
    type,
    changeType,
    operator,
    timestamp: new Date().toISOString(),
    data
  };
  writeJSON(historyPath, historyEntry);
  return historyEntry;
};

const getHistory = (type, id) => {
  const dir = path.join(HISTORY_DIR, type);
  if (!fs.existsSync(dir)) return [];
  
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith(`${id}-`) && f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.map(f => readJSON(path.join(dir, f)));
};

module.exports = {
  WORKSPACE_DIR,
  DATA_DIR,
  HISTORY_DIR,
  CONFIG_FILE,
  getWorkspaceStatus,
  ensureDirs,
  readJSON,
  writeJSON,
  getDataPath,
  getHistoryPath,
  saveHistory,
  getHistory
};
