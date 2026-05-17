const { v4: uuidv4 } = require('uuid');

const VISITOR_STATUSES = {
  PENDING: '待来访',
  REVOKING: '撤销中',
  REVOKED: '已撤销',
  ENTERED: '已入园'
};

class Visitor {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.visitorName = data.visitorName;
    this.visitorPhone = data.visitorPhone;
    this.hostName = data.hostName;
    this.hostDepartment = data.hostDepartment;
    this.visitStartTime = data.visitStartTime;
    this.visitEndTime = data.visitEndTime;
    this.qrCode = data.qrCode || `QR-${uuidv4().substring(0, 8).toUpperCase()}`;
    this.status = data.status || VISITOR_STATUSES.PENDING;
    this.revocationReason = data.revocationReason || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.batchId = data.batchId || null;
  }

  updateStatus(newStatus, reason = null) {
    this.status = newStatus;
    if (reason) {
      this.revocationReason = reason;
    }
    this.updatedAt = new Date().toISOString();
  }

  canRevoke() {
    return this.status === VISITOR_STATUSES.PENDING || this.status === VISITOR_STATUSES.REVOKING;
  }

  toJSON() {
    return {
      id: this.id,
      visitorName: this.visitorName,
      visitorPhone: this.visitorPhone,
      hostName: this.hostName,
      hostDepartment: this.hostDepartment,
      visitStartTime: this.visitStartTime,
      visitEndTime: this.visitEndTime,
      qrCode: this.qrCode,
      status: this.status,
      revocationReason: this.revocationReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      batchId: this.batchId
    };
  }
}

const visitorStore = new Map();

function addVisitor(visitor) {
  const v = new Visitor(visitor);
  visitorStore.set(v.id, v);
  return v;
}

function getVisitor(id) {
  return visitorStore.get(id);
}

function updateVisitor(id, data) {
  const visitor = visitorStore.get(id);
  if (!visitor) return null;
  Object.assign(visitor, data, { updatedAt: new Date().toISOString() });
  return visitor;
}

function listVisitors(filters = {}) {
  let result = Array.from(visitorStore.values());
  if (filters.status) {
    result = result.filter(v => v.status === filters.status);
  }
  if (filters.batchId) {
    result = result.filter(v => v.batchId === filters.batchId);
  }
  return result;
}

function clearVisitors() {
  visitorStore.clear();
}

module.exports = {
  Visitor,
  VISITOR_STATUSES,
  addVisitor,
  getVisitor,
  updateVisitor,
  listVisitors,
  clearVisitors
};
