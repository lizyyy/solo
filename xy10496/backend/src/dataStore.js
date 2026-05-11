const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PHONE_CACHE_FILE = path.join(DATA_DIR, 'phoneCache.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
  return defaultValue;
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e.message);
  }
}

module.exports = {
  readJSON,
  writeJSON,
  PHONE_CACHE_FILE,
  HISTORY_FILE,
  STATE_FILE,
  DATA_DIR
};
