const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadRecords() {
  ensureDataDir();
  if (!fs.existsSync(RECORDS_FILE)) {
    return [];
  }
  const content = fs.readFileSync(RECORDS_FILE, 'utf8');
  return JSON.parse(content || '[]');
}

function saveRecords(records) {
  ensureDataDir();
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function loadConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {
      timeoutHours: 24,
      duplicateWindowHours: 4,
      escalationLevels: ['工程主管', '项目经理', '物业总监']
    };
  }
  const content = fs.readFileSync(CONFIG_FILE, 'utf8');
  return JSON.parse(content);
}

function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function addRecord(record) {
  const records = loadRecords();
  const newRecord = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    ...record,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  records.push(newRecord);
  saveRecords(records);
  return newRecord;
}

function updateRecord(id, updates) {
  const records = loadRecords();
  const index = records.findIndex(r => r.id === id);
  if (index === -1) return null;
  records[index] = {
    ...records[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveRecords(records);
  return records[index];
}

function getRecord(id) {
  const records = loadRecords();
  return records.find(r => r.id === id) || null;
}

function queryRecords(filters = {}) {
  let records = loadRecords();
  
  if (filters.handler) {
    records = records.filter(r => r.handler && r.handler.includes(filters.handler));
  }
  if (filters.status) {
    records = records.filter(r => r.status === filters.status);
  }
  if (filters.anomalyType) {
    records = records.filter(r => r.anomalyType === filters.anomalyType);
  }
  if (filters.startDate) {
    records = records.filter(r => new Date(r.createdAt) >= new Date(filters.startDate));
  }
  if (filters.endDate) {
    records = records.filter(r => new Date(r.createdAt) <= new Date(filters.endDate));
  }
  if (filters.pumpRoom) {
    records = records.filter(r => r.pumpRoom && r.pumpRoom.includes(filters.pumpRoom));
  }
  
  return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  loadRecords,
  saveRecords,
  loadConfig,
  saveConfig,
  addRecord,
  updateRecord,
  getRecord,
  queryRecords
};
