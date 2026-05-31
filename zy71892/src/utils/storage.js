const fs = require('fs');
const path = require('path');

const RECORDS_FILE = 'records.json';
const HISTORY_FILE = 'history.json';

function loadRecords(dataDir) {
  const filePath = path.join(dataDir, RECORDS_FILE);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('读取记录文件失败:', e.message);
    return [];
  }
}

function saveRecords(dataDir, records) {
  const filePath = path.join(dataDir, RECORDS_FILE);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
}

function loadHistory(dataDir) {
  const filePath = path.join(dataDir, HISTORY_FILE);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('读取历史文件失败:', e.message);
    return {};
  }
}

function saveHistory(dataDir, history) {
  const filePath = path.join(dataDir, HISTORY_FILE);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
}

function generateId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BT-${dateStr}-${random}`;
}

function findRecord(records, recordId) {
  return records.find(r => r.id === recordId);
}

function addHistoryEntry(dataDir, recordId, action, details, operator = 'system') {
  const history = loadHistory(dataDir);
  if (!history[recordId]) {
    history[recordId] = [];
  }
  history[recordId].unshift({
    timestamp: new Date().toISOString(),
    action,
    details,
    operator
  });
  saveHistory(dataDir, history);
}

module.exports = {
  loadRecords,
  saveRecords,
  loadHistory,
  saveHistory,
  generateId,
  findRecord,
  addHistoryEntry
};
