const fs = require('fs');
const path = require('path');
const moment = require('moment');

class StorageService {
  constructor(dataDir = null) {
    this.dataDir = dataDir || path.join(__dirname, '..', 'data');
    this.ensureDataDir();
    this.dataFiles = {
      policies: 'policies.json',
      paymentPlans: 'payment_plans.json',
      advancePayments: 'advance_payments.json',
      visitRecords: 'visit_records.json',
      reminderRecords: 'reminder_records.json',
      reports: 'reports.json',
      config: 'config.json',
      dataVersion: 'data_version.json'
    };
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getFilePath(fileName) {
    return path.join(this.dataDir, fileName);
  }

  readData(fileName) {
    const filePath = this.getFilePath(fileName);
    
    if (!fs.existsSync(filePath)) {
      return this.getDefaultData(fileName);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`读取文件 ${fileName} 失败:`, error.message);
      return this.getDefaultData(fileName);
    }
  }

  writeData(fileName, data) {
    const filePath = this.getFilePath(fileName);
    
    try {
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, content, 'utf-8');
      this.updateDataVersion();
      return true;
    } catch (error) {
      console.error(`写入文件 ${fileName} 失败:`, error.message);
      return false;
    }
  }

  getDefaultData(fileName) {
    const defaults = {
      [this.dataFiles.policies]: [],
      [this.dataFiles.paymentPlans]: [],
      [this.dataFiles.advancePayments]: [],
      [this.dataFiles.visitRecords]: [],
      [this.dataFiles.reminderRecords]: [],
      [this.dataFiles.reports]: [],
      [this.dataFiles.config]: {
        gracePeriodDays: 60,
        defaultInterestRate: 0.05,
        reminderIntervals: [3, 7, 15, 30],
        autoAdvanceEnabled: false,
        lastUpdated: null
      },
      [this.dataFiles.dataVersion]: {
        version: 1,
        lastUpdated: null
      }
    };
    
    return defaults[fileName] || [];
  }

  updateDataVersion() {
    const versionData = this.readData(this.dataFiles.dataVersion);
    versionData.version += 1;
    versionData.lastUpdated = moment().format('YYYY-MM-DD HH:mm:ss');
    const filePath = this.getFilePath(this.dataFiles.dataVersion);
    fs.writeFileSync(filePath, JSON.stringify(versionData, null, 2), 'utf-8');
  }

  getDataVersion() {
    return this.readData(this.dataFiles.dataVersion);
  }

  savePolicies(policies) {
    return this.writeData(this.dataFiles.policies, policies);
  }

  getPolicies() {
    return this.readData(this.dataFiles.policies);
  }

  savePaymentPlans(paymentPlans) {
    return this.writeData(this.dataFiles.paymentPlans, paymentPlans);
  }

  getPaymentPlans() {
    return this.readData(this.dataFiles.paymentPlans);
  }

  saveAdvancePayments(advancePayments) {
    return this.writeData(this.dataFiles.advancePayments, advancePayments);
  }

  getAdvancePayments() {
    return this.readData(this.dataFiles.advancePayments);
  }

  saveVisitRecords(visitRecords) {
    return this.writeData(this.dataFiles.visitRecords, visitRecords);
  }

  getVisitRecords() {
    return this.readData(this.dataFiles.visitRecords);
  }

  saveReminderRecords(reminderRecords) {
    return this.writeData(this.dataFiles.reminderRecords, reminderRecords);
  }

  getReminderRecords() {
    return this.readData(this.dataFiles.reminderRecords);
  }

  saveReports(reports) {
    return this.writeData(this.dataFiles.reports, reports);
  }

  getReports() {
    return this.readData(this.dataFiles.reports);
  }

  saveConfig(config) {
    config.lastUpdated = moment().format('YYYY-MM-DD HH:mm:ss');
    return this.writeData(this.dataFiles.config, config);
  }

  getConfig() {
    return this.readData(this.dataFiles.config);
  }

  getAllData() {
    return {
      policies: this.getPolicies(),
      paymentPlans: this.getPaymentPlans(),
      advancePayments: this.getAdvancePayments(),
      visitRecords: this.getVisitRecords(),
      reminderRecords: this.getReminderRecords(),
      reports: this.getReports(),
      config: this.getConfig(),
      version: this.getDataVersion()
    };
  }

  saveAllData(data) {
    let success = true;
    
    if (data.policies) success = success && this.savePolicies(data.policies);
    if (data.paymentPlans) success = success && this.savePaymentPlans(data.paymentPlans);
    if (data.advancePayments) success = success && this.saveAdvancePayments(data.advancePayments);
    if (data.visitRecords) success = success && this.saveVisitRecords(data.visitRecords);
    if (data.reminderRecords) success = success && this.saveReminderRecords(data.reminderRecords);
    if (data.reports) success = success && this.saveReports(data.reports);
    if (data.config) success = success && this.saveConfig(data.config);
    
    return success;
  }

  exportData(format = 'json') {
    const data = this.getAllData();
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    return data;
  }

  importData(data, overwrite = false) {
    if (overwrite) {
      return this.saveAllData(data);
    }
    
    let success = true;
    
    if (data.policies) {
      const existing = this.getPolicies();
      const merged = this.mergeData(existing, data.policies, 'policyNo');
      success = success && this.savePolicies(merged);
    }
    
    if (data.paymentPlans) {
      const existing = this.getPaymentPlans();
      const merged = this.mergeData(existing, data.paymentPlans, 'planId');
      success = success && this.savePaymentPlans(merged);
    }
    
    if (data.advancePayments) {
      const existing = this.getAdvancePayments();
      const merged = this.mergeData(existing, data.advancePayments, 'recordId');
      success = success && this.saveAdvancePayments(merged);
    }
    
    if (data.visitRecords) {
      const existing = this.getVisitRecords();
      const merged = this.mergeData(existing, data.visitRecords, 'visitId');
      success = success && this.saveVisitRecords(merged);
    }
    
    if (data.reminderRecords) {
      const existing = this.getReminderRecords();
      const merged = this.mergeData(existing, data.reminderRecords, 'reminderId');
      success = success && this.saveReminderRecords(merged);
    }
    
    if (data.reports) {
      const existing = this.getReports();
      const merged = this.mergeData(existing, data.reports, 'reportId');
      success = success && this.saveReports(merged);
    }
    
    return success;
  }

  mergeData(existing, incoming, idField) {
    const map = new Map();
    
    existing.forEach(item => map.set(item[idField], item));
    incoming.forEach(item => map.set(item[idField], item));
    
    return Array.from(map.values());
  }

  backupData(backupDir = null) {
    const backupPath = backupDir || path.join(this.dataDir, 'backups');
    
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const backupFile = path.join(backupPath, `backup_${timestamp}.json`);
    
    try {
      const data = this.getAllData();
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, backupFile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  listBackups(backupDir = null) {
    const backupPath = backupDir || path.join(this.dataDir, 'backups');
    
    if (!fs.existsSync(backupPath)) {
      return [];
    }
    
    try {
      const files = fs.readdirSync(backupPath)
        .filter(file => file.startsWith('backup_') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(backupPath, file);
          const stats = fs.statSync(filePath);
          return {
            file,
            path: filePath,
            size: stats.size,
            created: stats.mtime
          };
        })
        .sort((a, b) => b.created - a.created);
      
      return files;
    } catch (error) {
      return [];
    }
  }

  restoreBackup(backupFile) {
    try {
      const content = fs.readFileSync(backupFile, 'utf-8');
      const data = JSON.parse(content);
      return this.saveAllData(data);
    } catch (error) {
      console.error('恢复备份失败:', error.message);
      return false;
    }
  }

  clearAllData() {
    const files = Object.values(this.dataFiles);
    let success = true;
    
    for (const file of files) {
      const filePath = this.getFilePath(file);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`删除文件 ${file} 失败:`, error.message);
          success = false;
        }
      }
    }
    
    return success;
  }
}

module.exports = StorageService;
