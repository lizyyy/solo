const { v4: uuidv4 } = require('uuid');

const VISITOR_STATUS = {
  APPLIED: 'APPLIED',
  APPROVED: 'APPROVED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  COMPANION_CONFIRMED: 'COMPANION_CONFIRMED',
  COMPANION_ABSENT: 'COMPANION_ABSENT',
  CHECKED_IN: 'CHECKED_IN',
  TIMEOUT: 'TIMEOUT',
  CHECKED_OUT: 'CHECKED_OUT',
  DEVICE_LEFT_BEHIND: 'DEVICE_LEFT_BEHIND',
  CANCELLED: 'CANCELLED'
};

const EVENT_TYPES = {
  CREATE_APPLICATION: 'CREATE_APPLICATION',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  CONFIRM_COMPANION: 'CONFIRM_COMPANION',
  COMPANION_ABSENT: 'COMPANION_ABSENT',
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  TIMEOUT: 'TIMEOUT',
  MANUAL_CORRECTION: 'MANUAL_CORRECTION',
  EXCEPTION_REPORT: 'EXCEPTION_REPORT'
};

const EXCEPTION_TYPES = {
  APPROVAL_MISSING: 'APPROVAL_MISSING',
  COMPANION_ABSENT: 'COMPANION_ABSENT',
  DEVICE_NOT_CHECKED_OUT: 'DEVICE_NOT_CHECKED_OUT',
  VISIT_TIMEOUT: 'VISIT_TIMEOUT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  UNKNOWN: 'UNKNOWN'
};

function createVisitorApplication(data) {
  const now = Date.now();
  const idempotencyKey = data.idempotencyKey || uuidv4();
  
  const visitor = {
    id: uuidv4(),
    idempotencyKey,
    name: data.name,
    phone: data.phone,
    company: data.company,
    idCard: data.idCard,
    purpose: data.purpose,
    visitorType: data.visitorType || 'EXTERNAL',
    
    status: VISITOR_STATUS.APPLIED,
    
    approverId: data.approverId,
    approvalStatus: null,
    approvalNote: null,
    approvedAt: null,
    
    companionId: data.companionId,
    companionName: data.companionName,
    companionConfirmed: false,
    companionConfirmedAt: null,
    
    devices: (data.devices || []).map(d => ({
      id: uuidv4(),
      type: d.type,
      brand: d.brand,
      model: d.model,
      serialNumber: d.serialNumber,
      description: d.description,
      checkedIn: false,
      checkedOut: false,
      checkedInAt: null,
      checkedOutAt: null
    })),
    
    expectedEntryTime: data.expectedEntryTime || now,
    expectedExitTime: data.expectedExitTime || (now + 8 * 60 * 60 * 1000),
    actualEntryTime: null,
    actualExitTime: null,
    
    history: [],
    exceptions: [],
    
    createdAt: now,
    updatedAt: now,
    createdBy: data.operatorId || 'SYSTEM'
  };
  
  return visitor;
}

function cloneDevice(device) {
  return { ...device };
}

module.exports = {
  VISITOR_STATUS,
  EVENT_TYPES,
  EXCEPTION_TYPES,
  createVisitorApplication,
  cloneDevice
};
