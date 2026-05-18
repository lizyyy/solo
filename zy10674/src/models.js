const { TICKET_STATUS } = require('./constants');

class Ticket {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.customerId = data.customerId;
    this.customerName = data.customerName;
    this.status = data.status || TICKET_STATUS.TIMING;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.slaDeadline = data.slaDeadline;
    this.actualResumeTime = data.actualResumeTime || null;
    this.totalPausedDuration = data.totalPausedDuration || 0;
    this.pauseRecords = data.pauseRecords || [];
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      customerId: this.customerId,
      customerName: this.customerName,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      slaDeadline: this.slaDeadline,
      actualResumeTime: this.actualResumeTime,
      totalPausedDuration: this.totalPausedDuration,
      pauseRecords: this.pauseRecords
    };
  }
}

class PauseRecord {
  constructor(data) {
    this.id = data.id;
    this.ticketId = data.ticketId;
    this.reason = data.reason;
    this.reasonDetail = data.reasonDetail || '';
    this.proofMaterials = data.proofMaterials || [];
    this.pausedBy = data.pausedBy;
    this.pausedAt = data.pausedAt || new Date().toISOString();
    this.resumedBy = data.resumedBy || null;
    this.resumedAt = data.resumedAt || null;
    this.status = data.status || 'active';
    this.customerWaiting = data.customerWaiting !== undefined ? data.customerWaiting : true;
    this.notes = data.notes || '';
  }

  toJSON() {
    return {
      id: this.id,
      ticketId: this.ticketId,
      reason: this.reason,
      reasonDetail: this.reasonDetail,
      proofMaterials: this.proofMaterials,
      pausedBy: this.pausedBy,
      pausedAt: this.pausedAt,
      resumedBy: this.resumedBy,
      resumedAt: this.resumedAt,
      status: this.status,
      customerWaiting: this.customerWaiting,
      notes: this.notes
    };
  }
}

module.exports = {
  Ticket,
  PauseRecord
};
