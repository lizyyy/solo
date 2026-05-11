const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.cwd(), '.invoice-gap');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return {
      orders: [],
      payments: [],
      invoices: [],
      notes: {},
      importedFiles: []
    };
  }
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(content);
}

function saveData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function isFileAlreadyImported(filePath) {
  const data = loadData();
  const absPath = path.resolve(filePath);
  return data.importedFiles.some(f => path.resolve(f) === absPath);
}

function markFileImported(filePath) {
  const data = loadData();
  const absPath = path.resolve(filePath);
  if (!data.importedFiles.includes(absPath)) {
    data.importedFiles.push(absPath);
    saveData(data);
  }
}

function getImportedFiles() {
  const data = loadData();
  return data.importedFiles;
}

function clearAllData() {
  if (fs.existsSync(DATA_FILE)) {
    fs.unlinkSync(DATA_FILE);
  }
}

module.exports = {
  loadData,
  saveData,
  isFileAlreadyImported,
  markFileImported,
  getImportedFiles,
  clearAllData,
  DATA_DIR
};
