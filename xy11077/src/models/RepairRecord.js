const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/repair-records.json');

class RepairRecord {
  static ensureDataFile() {
    if (!fs.existsSync(DATA_PATH)) {
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify([], null, 2));
    }
  }

  static getAll() {
    this.ensureDataFile();
    const data = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(data);
  }

  static saveAll(records) {
    this.ensureDataFile();
    fs.writeFileSync(DATA_PATH, JSON.stringify(records, null, 2));
  }

  static findById(id) {
    const records = this.getAll();
    return records.find(r => r.id === id);
  }

  static findByDormitory(building, roomNumber) {
    const records = this.getAll();
    return records.filter(r => 
      r.building === building && r.roomNumber === roomNumber
    );
  }

  static findByStatus(status) {
    const records = this.getAll();
    return records.filter(r => r.status === status);
  }

  static create(record) {
    const records = this.getAll();
    const newRecord = {
      id: `RR${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      mergeHistory: [],
      reviewLog: [],
      ...record
    };
    records.push(newRecord);
    this.saveAll(records);
    return newRecord;
  }

  static update(id, updates) {
    const records = this.getAll();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    const oldRecord = { ...records[index] };
    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: new Date().toISOString(),
      version: records[index].version + 1
    };
    this.saveAll(records);
    return { oldRecord, newRecord: records[index] };
  }

  static addMergeHistory(id, mergeInfo) {
    const records = this.getAll();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    records[index].mergeHistory = records[index].mergeHistory || [];
    records[index].mergeHistory.push({
      ...mergeInfo,
      mergedAt: new Date().toISOString()
    });
    records[index].updatedAt = new Date().toISOString();
    this.saveAll(records);
    return records[index];
  }

  static addReviewLog(id, reviewEntry) {
    const records = this.getAll();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    records[index].reviewLog = records[index].reviewLog || [];
    records[index].reviewLog.push({
      ...reviewEntry,
      timestamp: new Date().toISOString()
    });
    records[index].updatedAt = new Date().toISOString();
    this.saveAll(records);
    return records[index];
  }

  static delete(id) {
    const records = this.getAll();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) return false;
    this.saveAll(filtered);
    return true;
  }

  static getWeeklyReport(weekStart, weekEnd) {
    const records = this.getAll();
    return records.filter(r => {
      const createdAt = new Date(r.createdAt);
      return createdAt >= new Date(weekStart) && createdAt <= new Date(weekEnd);
    });
  }
}

module.exports = RepairRecord;
