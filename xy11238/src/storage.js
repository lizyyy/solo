const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'storage.json');

class Storage {
  constructor() {
    this.data = this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORAGE_FILE)) {
      try {
        const content = fs.readFileSync(STORAGE_FILE, 'utf8');
        return JSON.parse(content);
      } catch (e) {
        console.error('存储文件损坏，正在初始化新文件');
      }
    }

    const initialData = {
      applications: [],
      inventory: [],
      hazardRules: [],
      importHistory: [],
      reviewResults: [],
      errorRecords: []
    };
    this.save(initialData);
    return initialData;
  }

  save(data = this.data) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  addApplication(application) {
    this.data.applications.push(application);
    this.save();
  }

  addApplications(applications) {
    this.data.applications = [...this.data.applications, ...applications];
    this.save();
  }

  getApplications() {
    return this.data.applications;
  }

  setInventory(inventory) {
    this.data.inventory = inventory;
    this.save();
  }

  getInventory() {
    return this.data.inventory;
  }

  setHazardRules(rules) {
    this.data.hazardRules = rules;
    this.save();
  }

  getHazardRules() {
    return this.data.hazardRules;
  }

  addImportHistory(record) {
    this.data.importHistory.push({
      ...record,
      timestamp: new Date().toISOString()
    });
    this.save();
  }

  getImportHistory() {
    return this.data.importHistory;
  }

  addErrorRecord(error) {
    this.data.errorRecords.push({
      ...error,
      timestamp: new Date().toISOString()
    });
    this.save();
  }

  getErrorRecords() {
    return this.data.errorRecords;
  }

  addReviewResult(result) {
    this.data.reviewResults.push({
      ...result,
      timestamp: new Date().toISOString()
    });
    this.save();
  }

  getReviewResults() {
    return this.data.reviewResults;
  }

  clearAll() {
    this.data = {
      applications: [],
      inventory: [],
      hazardRules: [],
      importHistory: [],
      reviewResults: [],
      errorRecords: []
    };
    this.save();
  }

  getAllData() {
    return this.data;
  }
}

module.exports = new Storage();
