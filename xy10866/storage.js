const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  services: path.join(DATA_DIR, 'services.json'),
  endpoints: path.join(DATA_DIR, 'endpoints.json'),
  owners: path.join(DATA_DIR, 'owners.json'),
  environments: path.join(DATA_DIR, 'environments.json'),
  transitions: path.join(DATA_DIR, 'transitions.json'),
  requests: path.join(DATA_DIR, 'requests.json'),
  alerts: path.join(DATA_DIR, 'alerts.json')
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  Object.values(FILES).forEach(file => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([], null, 2));
    }
  });
}

function readData(file) {
  ensureDataDir();
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function writeData(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

class Storage {
  static generateId() {
    return uuidv4();
  }

  static getAll(type) {
    return readData(FILES[type]);
  }

  static getById(type, id) {
    const items = readData(FILES[type]);
    return items.find(item => item.id === id);
  }

  static create(type, data) {
    const items = readData(FILES[type]);
    const newItem = {
      id: this.generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    items.push(newItem);
    writeData(FILES[type], items);
    return newItem;
  }

  static update(type, id, data) {
    const items = readData(FILES[type]);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    items[index] = {
      ...items[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    writeData(FILES[type], items);
    return items[index];
  }

  static delete(type, id) {
    const items = readData(FILES[type]);
    const filtered = items.filter(item => item.id !== id);
    writeData(FILES[type], filtered);
    return filtered.length !== items.length;
  }

  static find(type, predicate) {
    const items = readData(FILES[type]);
    return items.filter(predicate);
  }

  static logRequest(requestData) {
    const requests = readData(FILES.requests);
    const log = {
      id: this.generateId(),
      ...requestData,
      timestamp: new Date().toISOString()
    };
    requests.push(log);
    writeData(FILES.requests, requests);
    return log;
  }
}

module.exports = Storage;
