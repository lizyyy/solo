const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const STORAGE_FILE = path.join(DATA_DIR, 'store.json');

const ensureDataDir = () => {
  fs.ensureDirSync(DATA_DIR);
};

const defaultStore = {
  households: [],
  donations: [],
  deliveries: [],
  signatures: [],
  exceptions: [],
  volunteers: []
};

const loadStore = () => {
  ensureDataDir();
  if (!fs.existsSync(STORAGE_FILE)) {
    saveStore(defaultStore);
    return { ...defaultStore };
  }
  try {
    const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('数据加载失败，使用空数据:', error.message);
    return { ...defaultStore };
  }
};

const saveStore = (store) => {
  ensureDataDir();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), 'utf-8');
};

const resetStore = () => {
  saveStore(defaultStore);
};

module.exports = {
  loadStore,
  saveStore,
  resetStore,
  DATA_DIR,
  STORAGE_FILE
};
