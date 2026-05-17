const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const dataStore = require('../store/DataStore');
const path = require('path');
const fs = require('fs');

class ExportService {
  constructor() {
    this.exportDir = path.join(process.cwd(), 'data', 'exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportAccountsToCSV(filters = {}) {
    let accounts = dataStore.getAllAccounts();
    
    if (filters.status) {
      accounts = accounts.filter(a => a.status === filters.status);
    }
    if (filters.borrower) {
      accounts = accounts.filter(a => a.currentBorrower === filters.borrower);
    }

    const records = accounts.map(account => ({
      id: account.id,
      accountNumber: account.accountNumber,
      status: account.status,
      description: account.description,
      currentBorrower: account.currentBorrower || '',
      currentDevice: account.currentDevice || '',
      leaseExpireAt: account.leaseExpireAt || '',
      totalBorrowCount: account.totalBorrowCount,
      lastBorrowAt: account.lastBorrowAt || '',
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }));

    const filePath = path.join(this.exportDir, `accounts_${Date.now()}.csv`);
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'accountNumber', title: '账号编号' },
        { id: 'status', title: '状态' },
        { id: 'description', title: '描述' },
        { id: 'currentBorrower', title: '当前借用人' },
        { id: 'currentDevice', title: '占用设备' },
        { id: 'leaseExpireAt', title: '租约到期时间' },
        { id: 'totalBorrowCount', title: '借用次数' },
        { id: 'lastBorrowAt', title: '最后借用时间' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });

    await csvWriter.writeRecords(records);
    return { filePath, recordCount: records.length };
  }

  async exportBorrowHistoryToCSV(accountNumber = null) {
    let records = dataStore.getAllBorrowRecords();
    
    if (accountNumber) {
      records = records.filter(r => r.accountNumber === accountNumber);
    }

    const csvRecords = records.map(record => ({
      id: record.id,
      accountNumber: record.accountNumber,
      borrower: record.borrower,
      purpose: record.purpose,
      device: record.device,
      status: record.status,
      expectedReturnAt: record.expectedReturnAt,
      actualReturnAt: record.actualReturnAt || '',
      borrowReport: record.borrowReport || '',
      createdAt: record.createdAt
    }));

    const suffix = accountNumber ? `_${accountNumber}` : '_all';
    const filePath = path.join(this.exportDir, `borrow_history${suffix}_${Date.now()}.csv`);
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'accountNumber', title: '账号编号' },
        { id: 'borrower', title: '借用人' },
        { id: 'purpose', title: '用途说明' },
        { id: 'device', title: '占用设备' },
        { id: 'status', title: '状态' },
        { id: 'expectedReturnAt', title: '预计归还时间' },
        { id: 'actualReturnAt', title: '实际归还时间' },
        { id: 'borrowReport', title: '借用报告' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(csvRecords);
    return { filePath, recordCount: csvRecords.length };
  }

  async exportOperationLogsToCSV(accountNumber = null) {
    let records = dataStore.getAllOperationLogs();
    
    if (accountNumber) {
      records = records.filter(r => r.accountNumber === accountNumber);
    }

    const csvRecords = records.map(record => ({
      id: record.id,
      operationType: record.operationType,
      accountId: record.accountId,
      operator: record.operator,
      reason: record.reason,
      originalInput: JSON.stringify(record.originalInput || {}),
      timestamp: record.timestamp
    }));

    const suffix = accountNumber ? `_${accountNumber}` : '_all';
    const filePath = path.join(this.exportDir, `operation_logs${suffix}_${Date.now()}.csv`);
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '日志ID' },
        { id: 'operationType', title: '操作类型' },
        { id: 'accountId', title: '账号ID' },
        { id: 'operator', title: '操作人' },
        { id: 'reason', title: '操作原因' },
        { id: 'originalInput', title: '原始输入' },
        { id: 'timestamp', title: '时间戳' }
      ]
    });

    await csvWriter.writeRecords(csvRecords);
    return { filePath, recordCount: csvRecords.length };
  }

  async exportAbnormalRecordsToCSV() {
    const records = dataStore.getAllAbnormalRecords();

    const csvRecords = records.map(record => ({
      id: record.id,
      accountNumber: record.accountNumber,
      type: record.type,
      reason: record.reason,
      operator: record.operator,
      originalBorrower: record.originalBorrower,
      originalDevice: record.originalDevice,
      borrowRecordId: record.borrowRecordId,
      createdAt: record.createdAt
    }));

    const filePath = path.join(this.exportDir, `abnormal_records_${Date.now()}.csv`);
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '异常记录ID' },
        { id: 'accountNumber', title: '账号编号' },
        { id: 'type', title: '异常类型' },
        { id: 'reason', title: '异常原因' },
        { id: 'operator', title: '处理人' },
        { id: 'originalBorrower', title: '原借用人' },
        { id: 'originalDevice', title: '原占用设备' },
        { id: 'borrowRecordId', title: '借用记录ID' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(csvRecords);
    return { filePath, recordCount: csvRecords.length };
  }

  async exportFullReport() {
    const results = await Promise.all([
      this.exportAccountsToCSV(),
      this.exportBorrowHistoryToCSV(),
      this.exportOperationLogsToCSV(),
      this.exportAbnormalRecordsToCSV()
    ]);

    return {
      accounts: results[0],
      borrowHistory: results[1],
      operationLogs: results[2],
      abnormalRecords: results[3]
    };
  }

  getExportedFiles() {
    if (!fs.existsSync(this.exportDir)) {
      return [];
    }
    const files = fs.readdirSync(this.exportDir);
    return files.map(file => ({
      filename: file,
      path: path.join(this.exportDir, file),
      size: fs.statSync(path.join(this.exportDir, file)).size,
      createdAt: fs.statSync(path.join(this.exportDir, file)).mtime
    })).sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = new ExportService();
