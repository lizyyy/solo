const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), '.badge-data');
const FILES = {
  attendees: path.join(DATA_DIR, 'attendees.json'),
  batches: path.join(DATA_DIR, 'batches.json'),
  history: path.join(DATA_DIR, 'history.json'),
  pending: path.join(DATA_DIR, 'pending.json')
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initFiles() {
  ensureDataDir();
  for (const [key, filePath] of Object.entries(FILES)) {
    if (!fs.existsSync(filePath)) {
      const initialData = key === 'batches' ? { nextNumber: 1 } : [];
      fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
    }
  }
}

function readJSON(filePath) {
  initFiles();
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function writeJSON(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getAttendees() {
  return readJSON(FILES.attendees);
}

function saveAttendees(attendees) {
  writeJSON(FILES.attendees, attendees);
}

function getBatches() {
  return readJSON(FILES.batches);
}

function saveBatches(batches) {
  writeJSON(FILES.batches, batches);
}

function getNextBatchNumber() {
  const batches = getBatches();
  const next = batches.nextNumber || 1;
  batches.nextNumber = next + 1;
  saveBatches(batches);
  return String(next).padStart(4, '0');
}

function getHistory() {
  return readJSON(FILES.history);
}

function saveHistory(history) {
  writeJSON(FILES.history, history);
}

function getPending() {
  return readJSON(FILES.pending);
}

function savePending(pending) {
  writeJSON(FILES.pending, pending);
}

function clearPending() {
  writeJSON(FILES.pending, []);
}

module.exports = {
  DATA_DIR,
  FILES,
  getAttendees,
  saveAttendees,
  getBatches,
  saveBatches,
  getNextBatchNumber,
  getHistory,
  saveHistory,
  getPending,
  savePending,
  clearPending,
  initFiles
};
