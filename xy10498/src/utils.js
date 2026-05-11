const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const MATERIALS_FILE = path.join(DATA_DIR, 'materials.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const LEADERS_FILE = path.join(DATA_DIR, 'leaders.json');
const RETURNS_FILE = path.join(DATA_DIR, 'returns.json');
const LOSSES_FILE = path.join(DATA_DIR, 'losses.json');
const DAMAGES_FILE = path.join(DATA_DIR, 'damages.json');
const CONSUMPTIONS_FILE = path.join(DATA_DIR, 'consumptions.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const ACTIVITY_DEMANDS_FILE = path.join(DATA_DIR, 'activity_demands.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filePath, defaultData = []) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    writeJSON(filePath, defaultData);
    return defaultData;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function writeJSON(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

module.exports = {
  DATA_DIR,
  MATERIALS_FILE,
  ACTIVITIES_FILE,
  LEADERS_FILE,
  RETURNS_FILE,
  LOSSES_FILE,
  DAMAGES_FILE,
  CONSUMPTIONS_FILE,
  INVENTORY_FILE,
  ACTIVITY_DEMANDS_FILE,
  readJSON,
  writeJSON,
  writeJSON,
  generateId
};
