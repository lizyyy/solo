const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const WORK_DIR = path.join(process.cwd(), '.club-reimbursement');
const DATA_DIR = path.join(WORK_DIR, 'data');
const HISTORY_DIR = path.join(WORK_DIR, 'history');

function ensureDirs() {
  if (!fs.existsSync(WORK_DIR)) {
    fs.mkdirSync(WORK_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

function getWorkDir() {
  return WORK_DIR;
}

function getDataDir() {
  return DATA_DIR;
}

function getHistoryDir() {
  return HISTORY_DIR;
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return null;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readCsvFile(filePath) {
  const csv = require('csv-parser');
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function writeCsvFile(filePath, data) {
  const { Parser } = require('json2csv');
  const parser = new Parser();
  const csv = parser.parse(data);
  fs.writeFileSync(filePath, csv, 'utf-8');
}

function generateId() {
  return uuidv4();
}

function getTimestamp() {
  return new Date().toISOString();
}

function isInitialized() {
  return fs.existsSync(path.join(DATA_DIR, 'budgets.json')) &&
         fs.existsSync(path.join(DATA_DIR, 'invoices.json')) &&
         fs.existsSync(path.join(DATA_DIR, 'approvals.json'));
}

module.exports = {
  ensureDirs,
  getWorkDir,
  getDataDir,
  getHistoryDir,
  readJsonFile,
  writeJsonFile,
  readCsvFile,
  writeCsvFile,
  generateId,
  getTimestamp,
  isInitialized
};
