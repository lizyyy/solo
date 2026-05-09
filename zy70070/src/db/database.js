const path = require('path');
const fs = require('fs');
const config = require('../../config.json');

const dbPath = path.resolve(__dirname, '../../', config.database.path.replace('.db', '.json'));
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const defaultData = {
  buildings: [],
  dorm_rooms: [],
  beds: [],
  students: [],
  access_cards: [],
  fees: [],
  fee_adjustments: [],
  transfer_applications: [],
  approval_records: [],
  access_sync_logs: [],
  operation_logs: [],
  history_snapshots: [],
  consistency_checks: [],
  counters: {
    buildings: 0,
    dorm_rooms: 0,
    beds: 0,
    students: 0,
    access_cards: 0,
    fees: 0,
    fee_adjustments: 0,
    transfer_applications: 0,
    approval_records: 0,
    access_sync_logs: 0,
    operation_logs: 0,
    history_snapshots: 0,
    consistency_checks: 0
  }
};

let data = null;
let writeTimer = null;

const loadData = () => {
  if (fs.existsSync(dbPath)) {
    try {
      data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      data = JSON.parse(JSON.stringify(defaultData));
    }
  } else {
    data = JSON.parse(JSON.stringify(defaultData));
  }
};

const scheduleWrite = () => {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('写入数据库失败:', e);
    }
    writeTimer = null;
  }, 10);
};

const db = {
  get data() {
    if (!data) loadData();
    return data;
  }
};

const initDb = async () => {
  loadData();
  scheduleWrite();
  console.log('数据库初始化完成');
};

const getNextId = (table) => {
  data.counters[table] = (data.counters[table] || 0) + 1;
  scheduleWrite();
  return data.counters[table];
};

const now = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

const runTransaction = (fn) => {
  const snapshot = JSON.stringify(data);
  try {
    fn();
    scheduleWrite();
    return true;
  } catch (error) {
    data = JSON.parse(snapshot);
    throw error;
  }
};

module.exports = {
  db,
  initDb,
  getNextId,
  now,
  runTransaction
};