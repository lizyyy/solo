const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const STAGING_DIR = path.join(DATA_DIR, 'staging');
const CONFIRMED_DIR = path.join(DATA_DIR, 'confirmed');

function ensureDirs() {
  [DATA_DIR, STAGING_DIR, CONFIRMED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function getStagingPath(type) {
  return path.join(STAGING_DIR, `${type}.json`);
}

function getConfirmedPath(type) {
  return path.join(CONFIRMED_DIR, `${type}.json`);
}

function readData(filePath, defaultValue = []) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return content ? JSON.parse(content) : defaultValue;
}

function writeData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getStagingData(type) {
  ensureDirs();
  return readData(getStagingPath(type));
}

function saveStagingData(type, data) {
  ensureDirs();
  writeData(getStagingPath(type), data);
}

function getConfirmedData(type) {
  ensureDirs();
  return readData(getConfirmedPath(type));
}

function saveConfirmedData(type, data) {
  ensureDirs();
  writeData(getConfirmedPath(type), data);
}

function getAllData(type) {
  const staging = getStagingData(type);
  const confirmed = getConfirmedData(type);
  return { staging, confirmed, all: [...confirmed, ...staging] };
}

module.exports = {
  ensureDirs,
  getStagingData,
  saveStagingData,
  getConfirmedData,
  saveConfirmedData,
  getAllData,
  DATA_DIR,
  STAGING_DIR,
  CONFIRMED_DIR
};
