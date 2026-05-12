const fs = require('fs');
const path = require('path');

const STRUCTURE = {
  cases: 'cases',
  materials: 'materials',
  invoices: 'invoices',
  rules: 'rules',
  reports: 'reports',
  history: 'history'
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function initWorkspace(workspace) {
  const dirs = Object.values(STRUCTURE).map(d => path.join(workspace, d));
  dirs.forEach(ensureDir);
  
  const indexPath = path.join(workspace, 'index.json');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify({
      initializedAt: new Date().toISOString(),
      version: '1.0.0',
      caseCount: 0
    }, null, 2));
  }
  
  return { success: true, workspace };
}

function isInitialized(workspace) {
  return fs.existsSync(path.join(workspace, 'index.json'));
}

function getIndex(workspace) {
  const indexPath = path.join(workspace, 'index.json');
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

function updateIndex(workspace, data) {
  const indexPath = path.join(workspace, 'index.json');
  const current = getIndex(workspace) || {};
  const updated = { ...current, ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(indexPath, JSON.stringify(updated, null, 2));
  return updated;
}

function getCasePath(workspace, caseId) {
  return path.join(workspace, STRUCTURE.cases, `${caseId}.json`);
}

function saveCase(workspace, caseData) {
  const casePath = getCasePath(workspace, caseData.id);
  fs.writeFileSync(casePath, JSON.stringify(caseData, null, 2));
  
  const index = getIndex(workspace) || {};
  const caseCount = (index.caseCount || 0) + 1;
  updateIndex(workspace, { caseCount });
  
  return caseData;
}

function loadCase(workspace, caseId) {
  const casePath = getCasePath(workspace, caseId);
  if (!fs.existsSync(casePath)) return null;
  return JSON.parse(fs.readFileSync(casePath, 'utf-8'));
}

function listAllCases(workspace) {
  const casesDir = path.join(workspace, STRUCTURE.cases);
  if (!fs.existsSync(casesDir)) return [];
  
  return fs.readdirSync(casesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .map(id => loadCase(workspace, id))
    .filter(Boolean);
}

function getHistoryPath(workspace, caseId) {
  return path.join(workspace, STRUCTURE.history, `${caseId}.json`);
}

function loadHistory(workspace, caseId) {
  const historyPath = getHistoryPath(workspace, caseId);
  if (!fs.existsSync(historyPath)) return [];
  return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
}

function saveHistoryEntry(workspace, caseId, entry) {
  const historyDir = path.join(workspace, STRUCTURE.history);
  ensureDir(historyDir);
  
  const history = loadHistory(workspace, caseId);
  const newEntry = {
    ...entry,
    id: `h_${Date.now()}`,
    timestamp: new Date().toISOString()
  };
  history.push(newEntry);
  
  const historyPath = getHistoryPath(workspace, caseId);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  
  return newEntry;
}

function saveRules(workspace, rules) {
  const rulesPath = path.join(workspace, STRUCTURE.rules, 'rules.json');
  ensureDir(path.join(workspace, STRUCTURE.rules));
  fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
  return rules;
}

function loadRules(workspace) {
  const rulesPath = path.join(workspace, STRUCTURE.rules, 'rules.json');
  if (!fs.existsSync(rulesPath)) return null;
  return JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
}

function saveReport(workspace, report) {
  const reportsDir = path.join(workspace, STRUCTURE.reports);
  ensureDir(reportsDir);
  const reportPath = path.join(reportsDir, `report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

module.exports = {
  initWorkspace,
  isInitialized,
  getIndex,
  updateIndex,
  saveCase,
  loadCase,
  listAllCases,
  loadHistory,
  saveHistoryEntry,
  saveRules,
  loadRules,
  saveReport,
  STRUCTURE
};
