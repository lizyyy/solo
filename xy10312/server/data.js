const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData(filename, defaultValue) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
    return defaultValue;
  }
}

function writeData(filename, data) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

module.exports = {
  readData,
  writeData,
  DATA_DIR
};
