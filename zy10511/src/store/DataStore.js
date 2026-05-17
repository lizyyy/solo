const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class DataStore {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.ensureDataDir();
    this.accountsFile = path.join(this.dataDir, 'accounts.json');
    this.borrowRecordsFile = path.join(this.dataDir, 'borrow_records.json');
    this.operationLogsFile = path.join(this.dataDir, 'operation_logs.json');
    this.abnormalRecordsFile = path.join(this.dataDir, 'abnormal_records.json');
    this.loadData();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadData() {
    this.accounts = this.loadJson(this.accountsFile, []);
    this.borrowRecords = this.loadJson(this.borrowRecordsFile, []);
    this.operationLogs = this.loadJson(this.operationLogsFile, []);
    this.abnormalRecords = this.loadJson(this.abnormalRecordsFile, []);
  }

  loadJson(file, defaultValue) {
    try {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`加载文件失败 ${file}:`, error);
    }
    return defaultValue;
  }

  saveData() {
    this.saveJson(this.accountsFile, this.accounts);
    this.saveJson(this.borrowRecordsFile, this.borrowRecords);
    this.saveJson(this.operationLogsFile, this.operationLogs);
    this.saveJson(this.abnormalRecordsFile, this.abnormalRecords);
  }

  saveJson(file, data) {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error(`保存文件失败 ${file}:`, error);
    }
  }

  generateId() {
    return uuidv4();
  }

  addAccount(account) {
    account.id = this.generateId();
    account.createdAt = new Date().toISOString();
    account.updatedAt = new Date().toISOString();
    this.accounts.push(account);
    this.saveData();
    return account;
  }

  updateAccount(accountId, updates) {
    const index = this.accounts.findIndex(a => a.id === accountId);
    if (index !== -1) {
      this.accounts[index] = { ...this.accounts[index], ...updates, updatedAt: new Date().toISOString() };
      this.saveData();
      return this.accounts[index];
    }
    return null;
  }

  getAccountById(accountId) {
    return this.accounts.find(a => a.id === accountId);
  }

  getAccountByNumber(accountNumber) {
    return this.accounts.find(a => a.accountNumber === accountNumber);
  }

  getAllAccounts() {
    return this.accounts;
  }

  addBorrowRecord(record) {
    record.id = this.generateId();
    record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    this.borrowRecords.push(record);
    this.saveData();
    return record;
  }

  updateBorrowRecord(recordId, updates) {
    const index = this.borrowRecords.findIndex(r => r.id === recordId);
    if (index !== -1) {
      this.borrowRecords[index] = { ...this.borrowRecords[index], ...updates, updatedAt: new Date().toISOString() };
      this.saveData();
      return this.borrowRecords[index];
    }
    return null;
  }

  getBorrowRecordById(recordId) {
    return this.borrowRecords.find(r => r.id === recordId);
  }

  getBorrowRecordsByAccount(accountId) {
    return this.borrowRecords.filter(r => r.accountId === accountId);
  }

  getActiveBorrowByAccount(accountId) {
    return this.borrowRecords.find(r => 
      r.accountId === accountId && 
      ['pending', 'active', 'overdue'].includes(r.status)
    );
  }

  getAllBorrowRecords() {
    return this.borrowRecords;
  }

  addOperationLog(log) {
    log.id = this.generateId();
    log.timestamp = new Date().toISOString();
    this.operationLogs.push(log);
    this.saveData();
    return log;
  }

  getOperationLogsByAccount(accountId) {
    return this.operationLogs.filter(l => l.accountId === accountId);
  }

  getAllOperationLogs() {
    return this.operationLogs;
  }

  addAbnormalRecord(record) {
    record.id = this.generateId();
    record.createdAt = new Date().toISOString();
    this.abnormalRecords.push(record);
    this.saveData();
    return record;
  }

  updateAbnormalRecord(recordId, updates) {
    const index = this.abnormalRecords.findIndex(r => r.id === recordId);
    if (index !== -1) {
      this.abnormalRecords[index] = { ...this.abnormalRecords[index], ...updates };
      this.saveData();
      return this.abnormalRecords[index];
    }
    return null;
  }

  getAllAbnormalRecords() {
    return this.abnormalRecords;
  }
}

module.exports = new DataStore();
