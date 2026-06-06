const fs = require('fs');
const path = require('path');
const { AudioRecord } = require('../models/AudioRecord');
const { WeeklyReport } = require('../models/WeeklyReport');

class DataStore {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(__dirname, '../data');
    this.recordsFile = path.join(this.dataDir, 'records.json');
    this.reportsFile = path.join(this.dataDir, 'reports.json');
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.recordsFile)) {
      fs.writeFileSync(this.recordsFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(this.reportsFile)) {
      fs.writeFileSync(this.reportsFile, JSON.stringify([], null, 2));
    }
  }

  readRecords() {
    const data = fs.readFileSync(this.recordsFile, 'utf8');
    const recordsData = JSON.parse(data);
    return recordsData.map(r => new AudioRecord(r));
  }

  writeRecords(records) {
    const data = records.map(r => r.toJSON());
    fs.writeFileSync(this.recordsFile, JSON.stringify(data, null, 2));
  }

  getRecordById(id) {
    const records = this.readRecords();
    return records.find(r => r.id === id);
  }

  addRecord(record) {
    const records = this.readRecords();
    records.push(record);
    this.writeRecords(records);
    return record;
  }

  updateRecord(record) {
    const records = this.readRecords();
    const index = records.findIndex(r => r.id === record.id);
    if (index !== -1) {
      records[index] = record;
      this.writeRecords(records);
      return record;
    }
    return null;
  }

  deleteRecord(id) {
    const records = this.readRecords();
    const filtered = records.filter(r => r.id !== id);
    this.writeRecords(filtered);
    return filtered.length !== records.length;
  }

  getRecordsByStatus(status) {
    const records = this.readRecords();
    return records.filter(r => r.status === status);
  }

  getRecordsAssignedTo(user) {
    const records = this.readRecords();
    return records.filter(r => r.assignedTo === user);
  }

  readReports() {
    const data = fs.readFileSync(this.reportsFile, 'utf8');
    const reportsData = JSON.parse(data);
    return reportsData.map(r => new WeeklyReport(r));
  }

  writeReports(reports) {
    const data = reports.map(r => r.toJSON());
    fs.writeFileSync(this.reportsFile, JSON.stringify(data, null, 2));
  }

  addReport(report) {
    const reports = this.readReports();
    reports.push(report);
    this.writeReports(reports);
    return report;
  }

  getLatestReport() {
    const reports = this.readReports();
    if (reports.length === 0) return null;
    return reports.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))[0];
  }

  getReportById(id) {
    const reports = this.readReports();
    return reports.find(r => r.id === id);
  }

  reset() {
    fs.writeFileSync(this.recordsFile, JSON.stringify([], null, 2));
    fs.writeFileSync(this.reportsFile, JSON.stringify([], null, 2));
  }
}

module.exports = new DataStore();
