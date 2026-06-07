const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BATCHES_FILE)) {
    fs.writeFileSync(BATCHES_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(RECORDS_FILE)) {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify([], null, 2));
  }
}

function readBatches() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(BATCHES_FILE, 'utf8'));
}

function writeBatches(batches) {
  ensureDataDir();
  fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches, null, 2));
}

function readRecords() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
}

function writeRecords(records) {
  ensureDataDir();
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

module.exports = {
  readBatches,
  writeBatches,
  readRecords,
  writeRecords,
  generateId,
  ensureDataDir
};
