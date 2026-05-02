const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const suppliesFile = path.join(dataDir, 'supplies.json');
const borrowRecordsFile = path.join(dataDir, 'borrowRecords.json');

function ensureDataFiles() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(suppliesFile)) {
    fs.writeFileSync(suppliesFile, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(borrowRecordsFile)) {
    fs.writeFileSync(borrowRecordsFile, JSON.stringify([], null, 2));
  }
}

function readSupplies() {
  ensureDataFiles();
  const data = fs.readFileSync(suppliesFile, 'utf8');
  return JSON.parse(data || '[]');
}

function writeSupplies(supplies) {
  ensureDataFiles();
  fs.writeFileSync(suppliesFile, JSON.stringify(supplies, null, 2));
}

function readBorrowRecords() {
  ensureDataFiles();
  const data = fs.readFileSync(borrowRecordsFile, 'utf8');
  return JSON.parse(data || '[]');
}

function writeBorrowRecords(records) {
  ensureDataFiles();
  fs.writeFileSync(borrowRecordsFile, JSON.stringify(records, null, 2));
}

module.exports = {
  readSupplies,
  writeSupplies,
  readBorrowRecords,
  writeBorrowRecords
};
