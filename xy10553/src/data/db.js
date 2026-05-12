const { VISITOR_STATUS } = require('../models/visitor');

class InMemoryDB {
  constructor() {
    this.visitors = new Map();
    this.idempotencyKeys = new Map();
    this.companions = new Map();
    this.approvers = new Map();
  }
  
  saveVisitor(visitor) {
    this.visitors.set(visitor.id, visitor);
    if (visitor.idempotencyKey) {
      this.idempotencyKeys.set(visitor.idempotencyKey, visitor.id);
    }
    return visitor;
  }
  
  getVisitor(id) {
    return this.visitors.get(id) || null;
  }
  
  getVisitorByIdempotencyKey(key) {
    const visitorId = this.idempotencyKeys.get(key);
    return visitorId ? this.getVisitor(visitorId) : null;
  }
  
  getAllVisitors(filter = {}) {
    let results = Array.from(this.visitors.values());
    
    if (filter.status) {
      results = results.filter(v => v.status === filter.status);
    }
    if (filter.idCard) {
      results = results.filter(v => v.idCard === filter.idCard);
    }
    if (filter.name) {
      results = results.filter(v => v.name.includes(filter.name));
    }
    if (filter.companionId) {
      results = results.filter(v => v.companionId === filter.companionId);
    }
    if (filter.hasExceptions) {
      results = results.filter(v => v.exceptions && v.exceptions.length > 0);
    }
    
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  getActiveVisitors() {
    return this.getAllVisitors().filter(v => 
      v.status === VISITOR_STATUS.CHECKED_IN || 
      v.status === VISITOR_STATUS.TIMEOUT
    );
  }
  
  getVisitorHistory(visitorId) {
    const visitor = this.getVisitor(visitorId);
    return visitor ? visitor.history : [];
  }
  
  registerCompanion(companion) {
    this.companions.set(companion.id, companion);
    return companion;
  }
  
  getCompanion(id) {
    return this.companions.get(id) || null;
  }
  
  getAllCompanions() {
    return Array.from(this.companions.values());
  }
  
  registerApprover(approver) {
    this.approvers.set(approver.id, approver);
    return approver;
  }
  
  getApprover(id) {
    return this.approvers.get(id) || null;
  }
  
  getAllApprovers() {
    return Array.from(this.approvers.values());
  }
}

module.exports = new InMemoryDB();
