const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), '.hazard-data');
const FILES = {
  hazards: path.join(DATA_DIR, 'hazards.json'),
  rectifications: path.join(DATA_DIR, 'rectifications.json'),
  reviews: path.join(DATA_DIR, 'reviews.json'),
  fines: path.join(DATA_DIR, 'fines.json'),
  audit: path.join(DATA_DIR, 'audit.json'),
  teams: path.join(DATA_DIR, 'teams.json')
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initStorage(sampleData = null) {
  ensureDataDir();
  
  const initialData = {
    hazards: [],
    rectifications: [],
    reviews: [],
    fines: [],
    audit: [],
    teams: []
  };

  if (sampleData) {
    Object.assign(initialData, sampleData);
  }

  for (const [key, filePath] of Object.entries(FILES)) {
    fs.writeFileSync(filePath, JSON.stringify(initialData[key] || [], null, 2));
  }
}

function readData(type) {
  ensureDataDir();
  const filePath = FILES[type];
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeData(type, data) {
  ensureDataDir();
  fs.writeFileSync(FILES[type], JSON.stringify(data, null, 2));
}

function isInitialized() {
  return fs.existsSync(FILES.hazards);
}

module.exports = {
  DATA_DIR,
  initStorage,
  readData,
  writeData,
  isInitialized
};
