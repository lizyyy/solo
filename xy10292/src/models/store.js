const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), '.kitchen-clean-data');

const FILES = {
  stores: path.join(DATA_DIR, 'stores.json'),
  cleaningRecords: path.join(DATA_DIR, 'cleaning-records.json'),
  businessIntensity: path.join(DATA_DIR, 'business-intensity.json'),
  fireInspections: path.join(DATA_DIR, 'fire-inspections.json'),
  history: path.join(DATA_DIR, 'history.json'),
  checkResults: path.join(DATA_DIR, 'check-results.json')
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile(filePath, defaultValue = []) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function recordHistory(operation, entityType, entityId, before, after, operator = 'system') {
  const history = readJsonFile(FILES.history, []);
  history.unshift({
    id: `HIST-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    operation,
    entityType,
    entityId,
    before,
    after,
    operator
  });
  writeJsonFile(FILES.history, history);
}

module.exports = {
  DATA_DIR,
  FILES,
  ensureDataDir,
  readJsonFile,
  writeJsonFile,
  recordHistory
};