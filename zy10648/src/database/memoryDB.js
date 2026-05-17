const Asset = require('../models/Asset');
const User = require('../models/User');
const { BorrowRecord } = require('../models/BorrowRecord');
const { ReminderRecord } = require('../models/ReminderRecord');

class MemoryDB {
  constructor() {
    this.assets = new Map();
    this.users = new Map();
    this.borrowRecords = new Map();
    this.reminderRecords = new Map();
    this.importErrors = [];
  }

  generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addAsset(data) {
    const id = data.id || this.generateId('asset');
    const asset = new Asset({ ...data, id });
    this.assets.set(id, asset);
    return asset;
  }

  getAsset(id) {
    return this.assets.get(id);
  }

  getAllAssets() {
    return Array.from(this.assets.values());
  }

  addUser(data) {
    const id = data.id || this.generateId('user');
    const user = new User({ ...data, id });
    this.users.set(id, user);
    return user;
  }

  getUser(id) {
    return this.users.get(id);
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  updateUserDepartment(userId, newDepartmentId, newDepartmentName) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    user.departmentId = newDepartmentId;
    user.departmentName = newDepartmentName;
    user.updatedAt = new Date();
    return user;
  }

  addBorrowRecord(data) {
    const id = data.id || this.generateId('borrow');
    const record = new BorrowRecord({ ...data, id });
    this.borrowRecords.set(id, record);
    return record;
  }

  getBorrowRecord(id) {
    return this.borrowRecords.get(id);
  }

  getAllBorrowRecords(filters = {}) {
    let records = Array.from(this.borrowRecords.values());
    if (filters.status) {
      records = records.filter(r => r.status === filters.status);
    }
    if (filters.userId) {
      records = records.filter(r => r.userId === filters.userId);
    }
    if (filters.hasDepartmentConflict !== undefined) {
      records = records.filter(r => r.hasDepartmentConflict === filters.hasDepartmentConflict);
    }
    return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateBorrowRecordStatus(id, status, actualReturnDate = null) {
    const record = this.borrowRecords.get(id);
    if (!record) {
      throw new Error('借用记录不存在');
    }
    record.status = status;
    if (actualReturnDate) {
      record.actualReturnDate = actualReturnDate;
    }
    record.updatedAt = new Date();
    return record;
  }

  markDepartmentConflict(id, conflictRemark) {
    const record = this.borrowRecords.get(id);
    if (!record) {
      throw new Error('借用记录不存在');
    }
    record.hasDepartmentConflict = true;
    record.conflictRemark = conflictRemark;
    record.updatedAt = new Date();
    return record;
  }

  checkDepartmentConflict(userId, recordDepartmentId) {
    const user = this.users.get(userId);
    if (!user) return false;
    return user.departmentId !== recordDepartmentId;
  }

  addReminderRecord(data) {
    const id = data.id || this.generateId('reminder');
    const record = new ReminderRecord({ ...data, id });
    this.reminderRecords.set(id, record);
    return record;
  }

  getReminderRecord(id) {
    return this.reminderRecords.get(id);
  }

  getRemindersByBorrowId(borrowRecordId) {
    return Array.from(this.reminderRecords.values())
      .filter(r => r.borrowRecordId === borrowRecordId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getAllReminderRecords() {
    return Array.from(this.reminderRecords.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateReminderStatus(id, status, sentAt = null, readAt = null) {
    const record = this.reminderRecords.get(id);
    if (!record) {
      throw new Error('催还记录不存在');
    }
    record.status = status;
    if (sentAt) record.sentAt = sentAt;
    if (readAt) record.readAt = readAt;
    record.updatedAt = new Date();
    return record;
  }

  addImportError(rowNumber, rowData, errorMessage) {
    this.importErrors.push({
      rowNumber,
      rowData,
      errorMessage,
      importedAt: new Date()
    });
  }

  getImportErrors() {
    return this.importErrors;
  }

  clearImportErrors() {
    this.importErrors = [];
  }
}

const db = new MemoryDB();
module.exports = db;
