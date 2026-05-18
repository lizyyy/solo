const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const VOLUNTEERS_FILE = path.join(DATA_DIR, 'volunteers.json');
const RECORDS_FILE = path.join(DATA_DIR, 'service-records.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile(filePath, defaultData) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    return defaultData;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取文件失败 ${filePath}:`, error.message);
    return defaultData;
  }
}

function writeJsonFile(filePath, data) {
  ensureDataDir();
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`写入文件失败 ${filePath}:`, error.message);
    return false;
  }
}

const storage = {
  getVolunteers: () => readJsonFile(VOLUNTEERS_FILE, []),
  saveVolunteers: (data) => writeJsonFile(VOLUNTEERS_FILE, data),
  
  getRecords: () => readJsonFile(RECORDS_FILE, []),
  saveRecords: (data) => writeJsonFile(RECORDS_FILE, data),

  getVolunteerById: (id) => {
    const volunteers = storage.getVolunteers();
    return volunteers.find(v => v.id === id);
  },

  addVolunteer: (volunteer) => {
    const volunteers = storage.getVolunteers();
    volunteers.push(volunteer);
    storage.saveVolunteers(volunteers);
    return volunteer;
  },

  updateVolunteer: (id, data) => {
    const volunteers = storage.getVolunteers();
    const index = volunteers.findIndex(v => v.id === id);
    if (index !== -1) {
      volunteers[index] = { ...volunteers[index], ...data, updatedAt: new Date().toISOString() };
      storage.saveVolunteers(volunteers);
      return volunteers[index];
    }
    return null;
  },

  getRecordById: (id) => {
    const records = storage.getRecords();
    return records.find(r => r.id === id);
  },

  getRecordsByVolunteerId: (volunteerId) => {
    const records = storage.getRecords();
    return records.filter(r => r.volunteerId === volunteerId);
  },

  addRecord: (record) => {
    const records = storage.getRecords();
    records.push(record);
    storage.saveRecords(records);
    return record;
  },

  updateRecord: (id, data) => {
    const records = storage.getRecords();
    const index = records.findIndex(r => r.id === id);
    if (index !== -1) {
      records[index] = { ...records[index], ...data, updatedAt: new Date().toISOString() };
      storage.saveRecords(records);
      return records[index];
    }
    return null;
  },

  deleteRecord: (id) => {
    const records = storage.getRecords();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length < records.length) {
      storage.saveRecords(filtered);
      return true;
    }
    return false;
  }
};

module.exports = storage;