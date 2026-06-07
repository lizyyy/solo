const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SONGS_FILE = path.join(DATA_DIR, 'songs.json');
const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');
const ENGINEER_NOTES_FILE = path.join(DATA_DIR, 'engineer_notes.json');
const ANNOTATIONS_FILE = path.join(DATA_DIR, 'annotations.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(file, defaultVal) {
  ensureDataDir();
  if (!fs.existsSync(file)) {
    return defaultVal;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return defaultVal;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  getSongs: () => readJson(SONGS_FILE, []),
  saveSongs: (data) => writeJson(SONGS_FILE, data),
  getLicenses: () => readJson(LICENSES_FILE, []),
  saveLicenses: (data) => writeJson(LICENSES_FILE, data),
  getEngineerNotes: () => readJson(ENGINEER_NOTES_FILE, []),
  saveEngineerNotes: (data) => writeJson(ENGINEER_NOTES_FILE, data),
  getAnnotations: () => readJson(ANNOTATIONS_FILE, []),
  saveAnnotations: (data) => writeJson(ANNOTATIONS_FILE, data),
};
