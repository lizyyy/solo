const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { STATES } = require('./stateMachine');

class ResponsiblePerson {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || '';
    this.employeeId = options.employeeId || '';
    this.role = options.role || '';
    this.department = options.department || '';
    this.phone = options.phone || '';
    this.email = options.email || '';
    this.status = options.status || STATES.PERSON.AVAILABLE;
    this.assignedBatchIds = options.assignedBatchIds || [];
    this.createdAt = options.createdAt || moment().toISOString();
    this.updatedAt = options.updatedAt || moment().toISOString();
  }

  assignBatch(batchId) {
    if (!this.assignedBatchIds.includes(batchId)) {
      this.assignedBatchIds.push(batchId);
      this.updatedAt = moment().toISOString();
    }
    return this;
  }

  removeBatch(batchId) {
    this.assignedBatchIds = this.assignedBatchIds.filter(id => id !== batchId);
    this.updatedAt = moment().toISOString();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      employeeId: this.employeeId,
      role: this.role,
      department: this.department,
      phone: this.phone,
      email: this.email,
      status: this.status,
      assignedBatchIds: this.assignedBatchIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new ResponsiblePerson(json);
  }
}

module.exports = ResponsiblePerson;
