const Customer = require('../models/Customer');
const TaskBatch = require('../models/TaskBatch');
const { CallRecord, CALL_STATUS } = require('../models/CallRecord');
const HistoryLog = require('../models/HistoryLog');

class MemoryDB {
  constructor() {
    this.customers = new Map();
    this.taskBatches = new Map();
    this.callRecords = new Map();
    this.historyLogs = new Map();
    this.counters = {
      customer: 1,
      taskBatch: 1,
      callRecord: 1,
      historyLog: 1
    };
    this._initSeedData();
  }

  _initSeedData() {
    this.addCustomer('招商银行', '张经理', '13800000001');
    this.addCustomer('平安保险', '李主管', '13800000002');
    
    this.addTaskBatch(1, '信用卡推广A批次', '2024年Q1信用卡推广任务', 'admin');
    this.addTaskBatch(2, '保险产品推荐B批次', '2024年寿险产品推荐任务', 'admin');
  }

  addCustomer(name, contact, phone) {
    const id = this.counters.customer++;
    const customer = new Customer(id, name, contact, phone);
    this.customers.set(id, customer);
    return customer;
  }

  addTaskBatch(customerId, name, description, createdBy) {
    const id = this.counters.taskBatch++;
    const taskBatch = new TaskBatch(id, customerId, name, description, createdBy);
    this.taskBatches.set(id, taskBatch);
    return taskBatch;
  }

  addCallRecord(taskBatchId, phoneNumber, customerName, importData = {}) {
    const id = this.counters.callRecord++;
    const callRecord = new CallRecord(id, taskBatchId, phoneNumber, customerName, importData);
    
    const existingRecords = this.findCallRecordsByPhone(phoneNumber);
    const activeRecords = existingRecords.filter(r => 
      r.status === CALL_STATUS.PENDING || 
      r.status === CALL_STATUS.CALLED
    );
    
    if (activeRecords.length > 0) {
      callRecord.status = CALL_STATUS.INTERCEPTED;
      callRecord.interceptReason = `号码重复，已在任务批次 ${activeRecords[0].taskBatchId} 中存在`;
      callRecord.interceptTime = new Date();
      
      const taskBatch = this.taskBatches.get(taskBatchId);
      if (taskBatch) {
        taskBatch.interceptedNumbers++;
        taskBatch.updatedAt = new Date();
      }
      
      this.addHistoryLog(
        id,
        'intercept',
        'system',
        `系统自动拦截：号码 ${phoneNumber} 在批次 ${activeRecords[0].taskBatchId} 中已存在`,
        CALL_STATUS.PENDING,
        CALL_STATUS.INTERCEPTED
      );
    } else {
      const taskBatch = this.taskBatches.get(taskBatchId);
      if (taskBatch) {
        taskBatch.totalNumbers++;
        taskBatch.updatedAt = new Date();
      }
      
      this.addHistoryLog(
        id,
        'create',
        'system',
        `号码 ${phoneNumber} 导入成功，状态为待呼叫`,
        null,
        CALL_STATUS.PENDING
      );
    }
    
    this.callRecords.set(id, callRecord);
    return callRecord;
  }

  addHistoryLog(callRecordId, action, operator, details, previousStatus, newStatus) {
    const id = this.counters.historyLog++;
    const historyLog = new HistoryLog(id, callRecordId, action, operator, details, previousStatus, newStatus);
    this.historyLogs.set(id, historyLog);
    return historyLog;
  }

  findCallRecordsByPhone(phoneNumber) {
    const results = [];
    for (const record of this.callRecords.values()) {
      if (record.phoneNumber === phoneNumber) {
        results.push(record);
      }
    }
    return results;
  }

  getHistoryLogsByCallRecordId(callRecordId) {
    const results = [];
    for (const log of this.historyLogs.values()) {
      if (log.callRecordId === callRecordId) {
        results.push(log);
      }
    }
    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  getCallRecords(filters = {}) {
    let results = Array.from(this.callRecords.values());
    
    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }
    if (filters.taskBatchId) {
      results = results.filter(r => r.taskBatchId === parseInt(filters.taskBatchId));
    }
    if (filters.phoneNumber) {
      results = results.filter(r => r.phoneNumber.includes(filters.phoneNumber));
    }
    
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = new MemoryDB();
