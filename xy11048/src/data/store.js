class DataStore {
  constructor() {
    this.reagents = new Map();
    this.approvalRequests = new Map();
    this.users = new Map();
    this.laboratories = new Map();
    this.usageRecords = new Map();
  }

  addReagent(reagent) {
    this.reagents.set(reagent.id, reagent);
    return reagent;
  }

  getReagent(id) {
    return this.reagents.get(id);
  }

  getAllReagents() {
    return Array.from(this.reagents.values());
  }

  addApprovalRequest(request) {
    this.approvalRequests.set(request.id, request);
    return request;
  }

  getApprovalRequest(id) {
    return this.approvalRequests.get(id);
  }

  getApprovalRequestByNo(requestNo) {
    return Array.from(this.approvalRequests.values()).find(r => r.requestNo === requestNo);
  }

  getAllApprovalRequests() {
    return Array.from(this.approvalRequests.values());
  }

  updateApprovalRequest(id, updates) {
    const request = this.approvalRequests.get(id);
    if (request) {
      Object.assign(request, updates);
      request.updatedAt = new Date();
      request.etag = request.generateEtag();
      return request;
    }
    return null;
  }

  addUser(user) {
    this.users.set(user.id, user);
    return user;
  }

  getUser(id) {
    return this.users.get(id);
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  addLaboratory(lab) {
    this.laboratories.set(lab.id, lab);
    return lab;
  }

  getLaboratory(id) {
    return this.laboratories.get(id);
  }

  getAllLaboratories() {
    return Array.from(this.laboratories.values());
  }

  addUsageRecord(record) {
    this.usageRecords.set(record.id, record);
    return record;
  }

  getUsageRecord(id) {
    return this.usageRecords.get(id);
  }

  getMonthlyUsage(userId, reagentId, month) {
    const start = new Date(month);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    
    return Array.from(this.usageRecords.values()).filter(record => 
      record.applicantId === userId && 
      record.reagentId === reagentId &&
      record.usedAt >= start && 
      record.usedAt <= end &&
      record.status === 'approved'
    ).reduce((sum, record) => sum + record.quantity, 0);
  }

  clear() {
    this.reagents.clear();
    this.approvalRequests.clear();
    this.users.clear();
    this.laboratories.clear();
    this.usageRecords.clear();
  }
}

module.exports = new DataStore();
