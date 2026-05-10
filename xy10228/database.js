const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'camera-inspection.json');

const defaultData = {
  consignments: [],
  inspection_items: [],
  defects: [],
  accessories: [],
  pricing_records: [],
  history: [],
  nextId: {
    consignments: 1,
    inspection_items: 1,
    defects: 1,
    accessories: 1,
    pricing_records: 1,
    history: 1
  }
};

let data = null;
let writeTimer = null;

function loadDB() {
  if (data) return;
  
  if (fs.existsSync(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf-8');
      data = JSON.parse(content);
    } catch (e) {
      data = JSON.parse(JSON.stringify(defaultData));
    }
  } else {
    data = JSON.parse(JSON.stringify(defaultData));
  }
}

function saveDB() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
  }, 50);
}

function getNextId(collection) {
  loadDB();
  const id = data.nextId[collection];
  data.nextId[collection]++;
  saveDB();
  return id;
}

function now() {
  return new Date().toISOString();
}

function read() {
  loadDB();
  return Promise.resolve();
}

function write() {
  saveDB();
  return Promise.resolve();
}

loadDB();

module.exports = {
  get data() { loadDB(); return data; },
  getNextId,
  now,
  read,
  write
};
