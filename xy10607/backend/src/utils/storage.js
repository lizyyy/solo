const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData(filename) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

function writeData(filename, data) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function updateData(filename, id, updates) {
  const items = readData(filename);
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
  writeData(filename, items);
  return items[index];
}

function deleteData(filename, id) {
  const items = readData(filename);
  const filtered = items.filter(item => item.id !== id);
  writeData(filename, filtered);
  return filtered.length !== items.length;
}

function findById(filename, id) {
  const items = readData(filename);
  return items.find(item => item.id === id) || null;
}

function findOne(filename, predicate) {
  const items = readData(filename);
  return items.find(predicate) || null;
}

module.exports = {
  readData,
  writeData,
  updateData,
  deleteData,
  findById,
  findOne,
  DATA_DIR
};
