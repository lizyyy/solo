const path = require('path');
const fs = require('fs');

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.mat-inspect');
const BATCHES_FILE = path.join(DEFAULT_DATA_DIR, 'batches.json');
const SAMPLES_FILE = path.join(DEFAULT_DATA_DIR, 'samples.json');
const TEST_ITEMS_FILE = path.join(DEFAULT_DATA_DIR, 'test-items.json');
const REPORTS_FILE = path.join(DEFAULT_DATA_DIR, 'reports.json');
const USAGES_FILE = path.join(DEFAULT_DATA_DIR, 'usages.json');
const HISTORY_FILE = path.join(DEFAULT_DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DEFAULT_DATA_DIR, 'config.json');

const BATCH_STATUS = {
  REGISTERED: '已进场',
  SAMPLING: '已取样',
  PENDING_REPORT: '待报告',
  REPORT_RECEIVED: '报告已回传',
  QUALIFIED: '可使用',
  UNQUALIFIED: '不合格',
  FROZEN: '已冻结',
  REINSPECTION: '复检中',
  VIOLATION: '违规使用'
};

const REPORT_STATUS = {
  PENDING: '待出',
  RECEIVED: '已回传',
  QUALIFIED: '合格',
  UNQUALIFIED: '不合格'
};

function ensureDataDir() {
  if (!fs.existsSync(DEFAULT_DATA_DIR)) {
    fs.mkdirSync(DEFAULT_DATA_DIR, { recursive: true });
  }
}

function initializeFiles() {
  ensureDataDir();
  
  const initFiles = [
    { path: BATCHES_FILE, data: [] },
    { path: SAMPLES_FILE, data: [] },
    { path: TEST_ITEMS_FILE, data: [] },
    { path: REPORTS_FILE, data: [] },
    { path: USAGES_FILE, data: [] },
    { path: HISTORY_FILE, data: [] },
    { path: CONFIG_FILE, data: { initializedAt: new Date().toISOString() } }
  ];
  
  initFiles.forEach(file => {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, JSON.stringify(file.data, null, 2));
    }
  });
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function writeJsonFile(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function isInitialized() {
  return fs.existsSync(CONFIG_FILE);
}

function addHistoryRecord(action, entityType, entityId, changes, operator = 'system', reason = '') {
  const history = readJsonFile(HISTORY_FILE) || [];
  const record = {
    id: `HIST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    changes: JSON.stringify(changes),
    operator,
    reason
  };
  history.push(record);
  writeJsonFile(HISTORY_FILE, history);
  return record;
}

module.exports = {
  DEFAULT_DATA_DIR,
  BATCHES_FILE,
  SAMPLES_FILE,
  TEST_ITEMS_FILE,
  REPORTS_FILE,
  USAGES_FILE,
  HISTORY_FILE,
  CONFIG_FILE,
  BATCH_STATUS,
  REPORT_STATUS,
  ensureDataDir,
  initializeFiles,
  readJsonFile,
  writeJsonFile,
  isInitialized,
  addHistoryRecord
};
