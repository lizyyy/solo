const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class LostItem {
  constructor(data) {
    this.id = uuidv4();
    this.itemName = data.itemName;
    this.itemDescription = data.itemDescription;
    this.photos = data.photos || [];
    this.foundLocation = data.foundLocation;
    this.foundTime = data.foundTime || new Date().toISOString();
    this.customerClues = data.customerClues || '';
    this.status = 'REGISTERED';
    this.statusHistory = [];
    this.currentHandler = data.currentHandler || '';
    this.storageExpiryDate = data.storageExpiryDate || moment().add(30, 'days').toISOString();
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.claimantInfo = null;
    this.disposalInfo = null;
    this.operationLogs = [];
  }

  addStatusHistory(status, reason, operator, oldValues = null, newValues = null) {
    this.statusHistory.push({
      id: uuidv4(),
      status,
      reason,
      operator,
      oldValues,
      newValues,
      timestamp: new Date().toISOString()
    });
    this.status = status;
    this.updatedAt = new Date().toISOString();
  }

  addOperationLog(action, details, operator) {
    this.operationLogs.push({
      id: uuidv4(),
      action,
      details,
      operator,
      timestamp: new Date().toISOString()
    });
  }
}

const STATUS_FLOW = {
  REGISTERED: '已登记',
  PENDING_VERIFICATION: '待核验',
  VERIFICATION_PASSED: '核验通过',
  VERIFICATION_FAILED: '核验异常',
  IN_STORAGE: '保管中',
  STORAGE_EXPIRED: '保管到期',
  DISPOSED: '已处置'
};

const lostItems = [];
const processedRequestIds = new Set();

module.exports = { LostItem, STATUS_FLOW, lostItems, processedRequestIds };