const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILES = {
  invitations: path.join(DATA_DIR, 'invitations.json'),
  roles: path.join(DATA_DIR, 'roles.json'),
  domains: path.join(DATA_DIR, 'domains.json'),
  approvals: path.join(DATA_DIR, 'approvals.json'),
  usages: path.join(DATA_DIR, 'usages.json'),
  revocations: path.join(DATA_DIR, 'revocations.json'),
  audit: path.join(DATA_DIR, 'audit.json')
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  Object.values(DATA_FILES).forEach(file => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([], null, 2));
    }
  });
}

function readData(key) {
  ensureDataDir();
  const data = fs.readFileSync(DATA_FILES[key], 'utf8');
  return JSON.parse(data);
}

function writeData(key, data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILES[key], JSON.stringify(data, null, 2));
}

function findById(key, id) {
  const items = readData(key);
  return items.find(item => item.id === id);
}

function insert(key, item) {
  const items = readData(key);
  items.push(item);
  writeData(key, items);
  return item;
}

function update(key, id, updates) {
  const items = readData(key);
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    writeData(key, items);
    return items[index];
  }
  return null;
}

function remove(key, id) {
  const items = readData(key);
  const filtered = items.filter(item => item.id !== id);
  writeData(key, filtered);
  return filtered.length !== items.length;
}

module.exports = {
  readData,
  writeData,
  findById,
  insert,
  update,
  remove,
  ensureDataDir
};
