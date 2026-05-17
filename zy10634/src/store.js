const { Compensation, STATUS_FLOW, REASSIGNMENT_TYPES } = require('./models/Compensation');

class CompensationStore {
  constructor() {
    this.compensations = new Map();
  }

  create(data) {
    const compensation = new Compensation(data);
    
    const existingRecords = this.findByOrderId(compensation.orderId);
    if (existingRecords.length > 0) {
      existingRecords.forEach(record => {
        if (!record.conflict) {
          record.markAsConflict(`订单${compensation.orderNo}存在多条补偿记录冲突`);
        }
      });
      compensation.markAsConflict(`订单${compensation.orderNo}存在多条补偿记录冲突`);
    }
    
    this.compensations.set(compensation.id, compensation);
    return compensation;
  }

  findById(id) {
    return this.compensations.get(id);
  }

  findByOrderId(orderId) {
    return Array.from(this.compensations.values()).filter(c => c.orderId === orderId);
  }

  findAll(filters = {}) {
    let results = Array.from(this.compensations.values());
    
    if (filters.status) {
      results = results.filter(c => c.status === filters.status);
    }
    if (filters.riderId) {
      results = results.filter(c => c.riderId === filters.riderId);
    }
    if (filters.reassignmentType) {
      results = results.filter(c => c.reassignmentType === filters.reassignmentType);
    }
    if (filters.conflict !== undefined) {
      results = results.filter(c => c.conflict === filters.conflict);
    }
    if (filters.importError !== undefined) {
      results = results.filter(c => c.importError === filters.importError);
    }
    
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateStatus(id, newStatus, reason, operator) {
    const compensation = this.findById(id);
    if (!compensation) {
      throw new Error('补偿记录不存在');
    }
    compensation.transitionTo(newStatus, reason, operator);
    return compensation;
  }

  delete(id) {
    const compensation = this.findById(id);
    if (compensation) {
      this.compensations.delete(id);
      return true;
    }
    return false;
  }

  clear() {
    this.compensations.clear();
  }

  count() {
    return this.compensations.size;
  }
}

module.exports = new CompensationStore();
