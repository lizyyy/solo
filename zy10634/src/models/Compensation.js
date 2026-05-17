const { v4: uuidv4 } = require('uuid');

const STATUS_FLOW = {
  PENDING_DISPATCH: '待派送',
  REASSIGNING: '改派中',
  COMPENSATION_PENDING: '补偿待审',
  SETTLED: '已结算'
};

const STATUS_TRANSITIONS = {
  [STATUS_FLOW.PENDING_DISPATCH]: [STATUS_FLOW.REASSIGNING],
  [STATUS_FLOW.REASSIGNING]: [STATUS_FLOW.COMPENSATION_PENDING],
  [STATUS_FLOW.COMPENSATION_PENDING]: [STATUS_FLOW.SETTLED],
  [STATUS_FLOW.SETTLED]: []
};

const REASSIGNMENT_TYPES = {
  RIDER_REJECT: '骑手拒单',
  SYSTEM_REASSIGN: '系统改派'
};

class Compensation {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.riderId = data.riderId;
    this.riderName = data.riderName;
    this.orderId = data.orderId;
    this.orderNo = data.orderNo;
    this.reassignmentType = data.reassignmentType;
    this.reason = data.reason;
    this.compensationAmount = parseFloat(data.compensationAmount) || 0;
    this.status = data.status || STATUS_FLOW.PENDING_DISPATCH;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.history = data.history || [];
    this.conflict = data.conflict || false;
    this.conflictNote = data.conflictNote || '';
    this.importError = data.importError || false;
    this.importErrorMsg = data.importErrorMsg || '';
    
    if (this.history.length === 0) {
      this.addHistory('创建记录', `初始状态: ${this.status}`, data.operator || 'system');
    }
  }

  addHistory(action, detail, operator = 'system') {
    this.history.push({
      id: uuidv4(),
      action,
      detail,
      operator,
      timestamp: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }

  canTransitionTo(newStatus) {
    const allowedTransitions = STATUS_TRANSITIONS[this.status] || [];
    return allowedTransitions.includes(newStatus);
  }

  transitionTo(newStatus, reason, operator = 'system') {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`状态流转非法: ${this.status} -> ${newStatus}`);
    }
    const oldStatus = this.status;
    this.status = newStatus;
    this.addHistory('状态变更', `${oldStatus} -> ${newStatus}${reason ? ` (${reason})` : ''}`, operator);
    return this;
  }

  markAsConflict(note) {
    this.conflict = true;
    this.conflictNote = note;
    this.addHistory('冲突标记', note, 'system');
    return this;
  }

  markAsImportError(msg) {
    this.importError = true;
    this.importErrorMsg = msg;
    this.addHistory('导入错误', msg, 'import');
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      riderId: this.riderId,
      riderName: this.riderName,
      orderId: this.orderId,
      orderNo: this.orderNo,
      reassignmentType: this.reassignmentType,
      reason: this.reason,
      compensationAmount: this.compensationAmount,
      status: this.status,
      conflict: this.conflict,
      conflictNote: this.conflictNote,
      importError: this.importError,
      importErrorMsg: this.importErrorMsg,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      history: this.history
    };
  }
}

module.exports = {
  Compensation,
  STATUS_FLOW,
  STATUS_TRANSITIONS,
  REASSIGNMENT_TYPES
};
