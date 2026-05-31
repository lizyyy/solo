const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'storage');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile(filename, defaultValue) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    return defaultValue;
  }
}

function writeJsonFile(filename, data) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  DATA_DIR
};
