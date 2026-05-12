const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const defaultData = {
  dishes: [],
  meals: [],
  sampleBoxes: [],
  responsiblePersons: [],
  samples: [],
  destroyRecords: [],
  temperatureLogs: [],
  alerts: []
};

const readData = () => {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { ...defaultData };
  }
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return { ...defaultData };
  }
};

const writeData = (data) => {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

class Storage {
  static getAll(collection) {
    const data = readData();
    return data[collection] || [];
  }

  static getById(collection, id) {
    const items = this.getAll(collection);
    return items.find(item => item.id === id);
  }

  static find(collection, predicate) {
    const items = this.getAll(collection);
    return items.filter(predicate);
  }

  static create(collection, item) {
    const data = readData();
    const newItem = { id: generateId(), createdAt: new Date().toISOString(), ...item };
    data[collection].push(newItem);
    writeData(data);
    return newItem;
  }

  static update(collection, id, updates) {
    const data = readData();
    const index = data[collection].findIndex(item => item.id === id);
    if (index === -1) return null;
    data[collection][index] = { ...data[collection][index], ...updates, updatedAt: new Date().toISOString() };
    writeData(data);
    return data[collection][index];
  }

  static delete(collection, id) {
    const data = readData();
    const index = data[collection].findIndex(item => item.id === id);
    if (index === -1) return false;
    data[collection].splice(index, 1);
    writeData(data);
    return true;
  }

  static reset() {
    writeData({ ...defaultData });
  }
}

module.exports = Storage;
