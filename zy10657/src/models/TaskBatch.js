class TaskBatch {
  constructor(id, customerId, name, description, createdBy) {
    this.id = id;
    this.customerId = customerId;
    this.name = name;
    this.description = description;
    this.createdBy = createdBy;
    this.status = 'active';
    this.totalNumbers = 0;
    this.calledNumbers = 0;
    this.interceptedNumbers = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

module.exports = TaskBatch;
