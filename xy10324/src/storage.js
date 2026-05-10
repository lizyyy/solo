const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');
const ATTENDANCES_FILE = path.join(DATA_DIR, 'attendances.json');
const LEAVES_FILE = path.join(DATA_DIR, 'leaves.json');
const MAKEUPS_FILE = path.join(DATA_DIR, 'makeups.json');
const TRANSFERS_FILE = path.join(DATA_DIR, 'transfers.json');
const CORRECTIONS_FILE = path.join(DATA_DIR, 'corrections.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(file, defaultValue) {
  if (!fs.existsSync(file)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return defaultValue;
  }
}

function writeJSON(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function loadAll() {
  return {
    students: readJSON(STUDENTS_FILE, []),
    schedules: readJSON(SCHEDULES_FILE, []),
    attendances: readJSON(ATTENDANCES_FILE, []),
    leaves: readJSON(LEAVES_FILE, []),
    makeups: readJSON(MAKEUPS_FILE, []),
    transfers: readJSON(TRANSFERS_FILE, []),
    corrections: readJSON(CORRECTIONS_FILE, [])
  };
}

function saveStudents(data) { writeJSON(STUDENTS_FILE, data); }
function saveSchedules(data) { writeJSON(SCHEDULES_FILE, data); }
function saveAttendances(data) { writeJSON(ATTENDANCES_FILE, data); }
function saveLeaves(data) { writeJSON(LEAVES_FILE, data); }
function saveMakeups(data) { writeJSON(MAKEUPS_FILE, data); }
function saveTransfers(data) { writeJSON(TRANSFERS_FILE, data); }
function saveCorrections(data) { writeJSON(CORRECTIONS_FILE, data); }

module.exports = {
  DATA_DIR,
  loadAll,
  saveStudents,
  saveSchedules,
  saveAttendances,
  saveLeaves,
  saveMakeups,
  saveTransfers,
  saveCorrections
};
