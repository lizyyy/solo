const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const dataFile = path.join(dataDir, 'warehouse-data.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let store = {
  warehouses: [],
  skus: [],
  inventory: [],
  orders: [],
  order_lines: [],
  waves: [],
  wave_orders: [],
  inventory_locks: [],
  stockouts: [],
  transfer_suggestions: [],
  status_history: [],
  manual_corrections: [],
  idempotency: []
};

function loadData() {
  if (fs.existsSync(dataFile)) {
    try {
      const data = fs.readFileSync(dataFile, 'utf8');
      store = { ...store, ...JSON.parse(data) };
    } catch (e) {
      console.warn('读取数据文件失败，使用空数据', e.message);
    }
  }
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

function resetData() {
  store = {
    warehouses: [],
    skus: [],
    inventory: [],
    orders: [],
    order_lines: [],
    waves: [],
    wave_orders: [],
    inventory_locks: [],
    stockouts: [],
    transfer_suggestions: [],
    status_history: [],
    manual_corrections: [],
    idempotency: []
  };
  saveData();
}

loadData();

module.exports = {
  store,
  saveData,
  resetData,
  loadData
};
