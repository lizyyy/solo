const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DATA_FILE = path.join(dataDir, 'sample_destruction.json');

const defaultData = {
  samples: [],
  samplesHistory: [],
  destructionTasks: [],
  approvals: [],
  photos: [],
  auditLogs: [],
  jobRuns: []
};

function loadData(customPath = null) {
  const filePath = customPath || DATA_FILE;
  if (!fs.existsSync(filePath)) {
    return JSON.parse(JSON.stringify(defaultData));
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    for (const key of Object.keys(defaultData)) {
      if (!data[key]) data[key] = [];
    }
    return data;
  } catch (err) {
    console.error('Error loading data:', err.message);
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function saveData(data, customPath = null) {
  const filePath = customPath || DATA_FILE;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

class Database {
  constructor(customPath = null) {
    this.filePath = customPath;
    this.data = loadData(customPath);
  }
  
  save() {
    saveData(this.data, this.filePath);
  }
  
  getSamples() {
    return this.data.samples;
  }
  
  addSample(sample) {
    this.data.samples.push(sample);
    this.save();
    return sample;
  }
  
  findSample(predicate) {
    return this.data.samples.find(predicate);
  }
  
  filterSamples(predicate) {
    return this.data.samples.filter(predicate);
  }
  
  updateSample(id, updates) {
    const idx = this.data.samples.findIndex(s => s.id === id);
    if (idx === -1) return null;
    this.data.samples[idx] = { ...this.data.samples[idx], ...updates };
    this.save();
    return this.data.samples[idx];
  }
  
  addHistory(record) {
    this.data.samplesHistory.push(record);
    this.save();
    return record;
  }
  
  findHistory(predicate) {
    return this.data.samplesHistory.filter(predicate);
  }
  
  addTask(task) {
    this.data.destructionTasks.push(task);
    this.save();
    return task;
  }
  
  findTask(predicate) {
    return this.data.destructionTasks.find(predicate);
  }
  
  filterTasks(predicate) {
    return this.data.destructionTasks.filter(predicate);
  }
  
  updateTask(id, updates) {
    const idx = this.data.destructionTasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.data.destructionTasks[idx] = { ...this.data.destructionTasks[idx], ...updates };
    this.save();
    return this.data.destructionTasks[idx];
  }
  
  addApproval(approval) {
    this.data.approvals.push(approval);
    this.save();
    return approval;
  }
  
  findApproval(predicate) {
    return this.data.approvals.find(predicate);
  }
  
  filterApprovals(predicate) {
    return this.data.approvals.filter(predicate);
  }
  
  updateApproval(id, updates) {
    const idx = this.data.approvals.findIndex(a => a.id === id);
    if (idx === -1) return null;
    this.data.approvals[idx] = { ...this.data.approvals[idx], ...updates };
    this.save();
    return this.data.approvals[idx];
  }
  
  addPhoto(photo) {
    this.data.photos.push(photo);
    this.save();
    return photo;
  }
  
  filterPhotos(predicate) {
    return this.data.photos.filter(predicate);
  }
  
  addAuditLog(log) {
    this.data.auditLogs.push(log);
    this.save();
    return log;
  }
  
  filterAuditLogs(predicate) {
    return this.data.auditLogs.filter(predicate);
  }
  
  addJobRun(run) {
    this.data.jobRuns.push(run);
    this.save();
    return run;
  }
  
  findJobRun(predicate) {
    return this.data.jobRuns.find(predicate);
  }
  
  filterJobRuns(predicate) {
    return this.data.jobRuns.filter(predicate);
  }
  
  transaction(fn) {
    const backup = JSON.parse(JSON.stringify(this.data));
    try {
      fn();
      this.save();
    } catch (err) {
      this.data = backup;
      this.save();
      throw err;
    }
  }
}

let dbInstance = null;

function getDatabase(customPath = null) {
  if (customPath) {
    return new Database(customPath);
  }
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

module.exports = { getDatabase, loadData, saveData, Database };
