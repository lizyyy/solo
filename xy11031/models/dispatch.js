const { v4: uuidv4 } = require('uuid');

const DISPATCH_STATUS = {
  PENDING: 'pending',
  LOCKED: 'locked',
  DISPATCHED: 'dispatched',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NEEDS_REVIEW: 'needs_review'
};

const APPLIANCE_TYPES = {
  AIR_CONDITIONER: 'air_conditioner',
  WASHING_MACHINE: 'washing_machine',
  REFRIGERATOR: 'refrigerator',
  TV: 'tv',
  WATER_HEATER: 'water_heater',
  KITCHEN_HOOD: 'kitchen_hood',
  GAS_STOVE: 'gas_stove',
  DISHWASHER: 'dishwasher'
};

const ISSUE_TYPES = {
  TIME_SLOT_OVERLAP: 'time_slot_overlap',
  AUDIT_INCONSISTENCY: 'audit_inconsistency',
  DUPLICATE_ORDER: 'duplicate_order',
  INVALID_STATUS_TRANSITION: 'invalid_status_transition',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  INVALID_PHONE: 'invalid_phone',
  INVALID_ADDRESS: 'invalid_address',
  TECHNICIAN_NOT_FOUND: 'technician_not_found'
};

class DispatchOrder {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.orderNo = data.orderNo || '';
    this.customerName = data.customerName || '';
    this.customerPhone = data.customerPhone || '';
    this.customerAddress = data.customerAddress || '';
    this.applianceType = data.applianceType || '';
    this.applianceBrand = data.applianceBrand || '';
    this.applianceModel = data.applianceModel || '';
    this.installationType = data.installationType || '';
    this.scheduledDate = data.scheduledDate || '';
    this.timeSlotStart = data.timeSlotStart || '';
    this.timeSlotEnd = data.timeSlotEnd || '';
    this.technicianId = data.technicianId || '';
    this.technicianName = data.technicianName || '';
    this.technicianPhone = data.technicianPhone || '';
    this.technicianTeam = data.technicianTeam || '';
    this.status = data.status || DISPATCH_STATUS.PENDING;
    this.dispatchTime = data.dispatchTime || null;
    this.acceptTime = data.acceptTime || null;
    this.arrivalTime = data.arrivalTime || null;
    this.completeTime = data.completeTime || null;
    this.installationFee = data.installationFee || 0;
    this.materialFee = data.materialFee || 0;
    this.totalFee = data.totalFee || 0;
    this.notes = data.notes || '';
    this.auditStatus = data.auditStatus || 'pending';
    this.auditNotes = data.auditNotes || '';
    this.manualRemarks = data.manualRemarks || [];
    this.issues = data.issues || [];
    this.needsReview = data.needsReview || false;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.importBatchId = data.importBatchId || '';
    this.originalRowData = data.originalRowData || null;
  }

  addIssue(issue) {
    this.issues.push({
      id: uuidv4(),
      type: issue.type,
      reason: issue.reason,
      suggestion: issue.suggestion,
      timestamp: new Date().toISOString(),
      resolved: false
    });
    this.needsReview = true;
    this.status = DISPATCH_STATUS.NEEDS_REVIEW;
  }

  addManualRemark(remark, operator) {
    this.manualRemarks.push({
      id: uuidv4(),
      content: remark,
      operator: operator,
      timestamp: new Date().toISOString()
    });
  }

  resolveIssue(issueId, resolution) {
    const issue = this.issues.find(i => i.id === issueId);
    if (issue) {
      issue.resolved = true;
      issue.resolution = resolution;
      issue.resolvedAt = new Date().toISOString();
    }
    const unresolvedIssues = this.issues.filter(i => !i.resolved);
    if (unresolvedIssues.length === 0) {
      this.needsReview = false;
      this.status = DISPATCH_STATUS.PENDING;
    }
  }

  toJSON() {
    return {
      id: this.id,
      orderNo: this.orderNo,
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      customerAddress: this.customerAddress,
      applianceType: this.applianceType,
      applianceBrand: this.applianceBrand,
      applianceModel: this.applianceModel,
      installationType: this.installationType,
      scheduledDate: this.scheduledDate,
      timeSlotStart: this.timeSlotStart,
      timeSlotEnd: this.timeSlotEnd,
      technicianId: this.technicianId,
      technicianName: this.technicianName,
      technicianPhone: this.technicianPhone,
      technicianTeam: this.technicianTeam,
      status: this.status,
      dispatchTime: this.dispatchTime,
      acceptTime: this.acceptTime,
      arrivalTime: this.arrivalTime,
      completeTime: this.completeTime,
      installationFee: this.installationFee,
      materialFee: this.materialFee,
      totalFee: this.totalFee,
      notes: this.notes,
      auditStatus: this.auditStatus,
      auditNotes: this.auditNotes,
      manualRemarks: this.manualRemarks,
      issues: this.issues,
      needsReview: this.needsReview,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      importBatchId: this.importBatchId
    };
  }
}

class ImportResult {
  constructor(batchId) {
    this.batchId = batchId;
    this.totalCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.needsReviewCount = 0;
    this.successOrders = [];
    this.failedRows = [];
    this.needsReviewOrders = [];
    this.startTime = new Date().toISOString();
    this.endTime = null;
  }

  addSuccess(order) {
    this.successCount++;
    this.successOrders.push(order.toJSON());
  }

  addFailure(rowData, reason, suggestion) {
    this.failureCount++;
    this.failedRows.push({
      rowNumber: this.totalCount,
      originalData: rowData,
      reason: reason,
      suggestion: suggestion
    });
  }

  addNeedsReview(order) {
    this.needsReviewCount++;
    this.needsReviewOrders.push(order.toJSON());
  }

  complete() {
    this.endTime = new Date().toISOString();
  }

  toJSON() {
    return {
      batchId: this.batchId,
      summary: {
        total: this.totalCount,
        success: this.successCount,
        failed: this.failureCount,
        needsReview: this.needsReviewCount
      },
      successOrders: this.successOrders,
      failedRows: this.failedRows,
      needsReviewOrders: this.needsReviewOrders,
      startTime: this.startTime,
      endTime: this.endTime
    };
  }
}

module.exports = {
  DispatchOrder,
  ImportResult,
  DISPATCH_STATUS,
  APPLIANCE_TYPES,
  ISSUE_TYPES
};
