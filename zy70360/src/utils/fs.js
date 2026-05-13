const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJSON(filePath, defaultValue = []) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) {
    return defaultValue;
  }
  try {
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function appendJSON(filePath, item) {
  const data = readJSON(filePath, []);
  data.push(item);
  writeJSON(filePath, data);
}

function updateJSON(filePath, predicate, updater) {
  const data = readJSON(filePath, []);
  const index = data.findIndex(predicate);
  if (index !== -1) {
    data[index] = updater(data[index]);
    writeJSON(filePath, data);
    return true;
  }
  return false;
}

function removeJSON(filePath, predicate) {
  const data = readJSON(filePath, []);
  const newData = data.filter(item => !predicate(item));
  writeJSON(filePath, newData);
  return data.length - newData.length;
}

function findJSON(filePath, predicate) {
  const data = readJSON(filePath, []);
  return data.find(predicate);
}

function filterJSON(filePath, predicate) {
  const data = readJSON(filePath, []);
  return data.filter(predicate);
}

module.exports = {
  ensureDir,
  readJSON,
  writeJSON,
  appendJSON,
  updateJSON,
  removeJSON,
  findJSON,
  filterJSON
};
