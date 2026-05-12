const path = require('path');
const fs = require('fs');

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.inspection-data');

const CONFIG_FILE = path.join(DEFAULT_DATA_DIR, 'config.json');

const FILES = {
  STORES: path.join(DEFAULT_DATA_DIR, 'stores.json'),
  INSPECTIONS: path.join(DEFAULT_DATA_DIR, 'inspections.json'),
  ISSUES: path.join(DEFAULT_DATA_DIR, 'issues.json'),
  CORRECTIONS: path.join(DEFAULT_DATA_DIR, 'corrections.json'),
  REINSPECTIONS: path.join(DEFAULT_DATA_DIR, 'reinspections.json'),
  SCORES: path.join(DEFAULT_DATA_DIR, 'scores.json'),
  LOGS: path.join(DEFAULT_DATA_DIR, 'audit-logs.json')
};

const ISSUE_CATEGORIES = ['陈列', '卫生', '价格牌', '安全隐患'];

const STATUS = {
  PENDING: '待整改',
  IN_PROGRESS: '整改中',
  SUBMITTED: '已提交整改',
  REINSPECTING: '待复查',
  PASSED: '已通过',
  FAILED: '复查不通过',
  OVERDUE: '已逾期',
  CLOSED: '已闭环'
};

const DEFAULT_CONFIG = {
  defaultCorrectionDays: 3,
  overduePenaltyPoints: 2,
  reinspectionFailPenalty: 1,
  totalBaseScore: 100
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isInitialized() {
  return fs.existsSync(CONFIG_FILE);
}

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

module.exports = {
  DEFAULT_DATA_DIR,
  CONFIG_FILE,
  FILES,
  ISSUE_CATEGORIES,
  STATUS,
  DEFAULT_CONFIG,
  ensureDir,
  isInitialized,
  readConfig,
  writeConfig
};
