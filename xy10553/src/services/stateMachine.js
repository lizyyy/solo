const { v4: uuidv4 } = require('uuid');

const { VISITOR_STATUS, EVENT_TYPES, EXCEPTION_TYPES } = require('../models/visitor');

const stateTransitions = {
  [VISITOR_STATUS.APPLIED]: {
    allowedEvents: [EVENT_TYPES.APPROVE, EVENT_TYPES.REJECT, EVENT_TYPES.MANUAL_CORRECTION]
  },
  [VISITOR_STATUS.APPROVED]: {
    allowedEvents: [EVENT_TYPES.CONFIRM_COMPANION, EVENT_TYPES.COMPANION_ABSENT, EVENT_TYPES.MANUAL_CORRECTION, EVENT_TYPES.CANCELLED]
  },
  [VISITOR_STATUS.APPROVAL_REJECTED]: {
    allowedEvents: [EVENT_TYPES.MANUAL_CORRECTION, EVENT_TYPES.CANCELLED]
  },
  [VISITOR_STATUS.COMPANION_CONFIRMED]: {
    allowedEvents: [EVENT_TYPES.CHECK_IN, EVENT_TYPES.MANUAL_CORRECTION, EVENT_TYPES.CANCELLED]
  },
  [VISITOR_STATUS.COMPANION_ABSENT]: {
    allowedEvents: [EVENT_TYPES.CONFIRM_COMPANION, EVENT_TYPES.MANUAL_CORRECTION, EVENT_TYPES.CANCELLED]
  },
  [VISITOR_STATUS.CHECKED_IN]: {
    allowedEvents: [EVENT_TYPES.CHECK_OUT, EVENT_TYPES.TIMEOUT, EVENT_TYPES.MANUAL_CORRECTION, EVENT_TYPES.EXCEPTION_REPORT]
  },
  [VISITOR_STATUS.TIMEOUT]: {
    allowedEvents: [EVENT_TYPES.MANUAL_CORRECTION, EVENT_TYPES.EXCEPTION_REPORT]
  },
  [VISITOR_STATUS.CHECKED_OUT]: {
    allowedEvents: [EVENT_TYPES.MANUAL_CORRECTION]
  },
  [VISITOR_STATUS.DEVICE_LEFT_BEHIND]: {
    allowedEvents: [EVENT_TYPES.MANUAL_CORRECTION, EVENT_TYPES.EXCEPTION_REPORT]
  },
  [VISITOR_STATUS.CANCELLED]: {
    allowedEvents: [EVENT_TYPES.MANUAL_CORRECTION]
  }
};

const eventToStatus = {
  [EVENT_TYPES.APPROVE]: VISITOR_STATUS.APPROVED,
  [EVENT_TYPES.REJECT]: VISITOR_STATUS.APPROVAL_REJECTED,
  [EVENT_TYPES.CONFIRM_COMPANION]: VISITOR_STATUS.COMPANION_CONFIRMED,
  [EVENT_TYPES.COMPANION_ABSENT]: VISITOR_STATUS.COMPANION_ABSENT,
  [EVENT_TYPES.CHECK_IN]: VISITOR_STATUS.CHECKED_IN,
  [EVENT_TYPES.CHECK_OUT]: VISITOR_STATUS.CHECKED_OUT,
  [EVENT_TYPES.TIMEOUT]: VISITOR_STATUS.TIMEOUT,
  [EVENT_TYPES.CANCELLED]: VISITOR_STATUS.CANCELLED
};

function validateTransition(visitor, eventType) {
  const currentState = visitor.status;
  const stateConfig = stateTransitions[currentState];
  
  if (!stateConfig) {
    return { valid: false, reason: `Unknown state: ${currentState}` };
  }
  
  if (eventType === EVENT_TYPES.MANUAL_CORRECTION) {
    return { valid: true };
  }
  
  if (eventType === EVENT_TYPES.EXCEPTION_REPORT) {
    return { valid: true };
  }
  
  if (!stateConfig.allowedEvents.includes(eventType)) {
    return { 
      valid: false, 
      reason: `Event ${eventType} not allowed from state ${currentState}. Allowed: ${stateConfig.allowedEvents.join(', ')}` 
    };
  }
  
  return { valid: true };
}

function checkBusinessRules(visitor, eventType, eventData, db) {
  const errors = [];
  
  switch (eventType) {
    case EVENT_TYPES.APPROVE:
      if (!eventData.approverId) {
        errors.push({ code: 'APPROVER_REQUIRED', message: '审批人ID不能为空' });
      }
      break;
      
    case EVENT_TYPES.CONFIRM_COMPANION:
      if (!eventData.companionId) {
        errors.push({ code: 'COMPANION_REQUIRED', message: '陪同人ID不能为空' });
      }
      break;
      
    case EVENT_TYPES.CHECK_IN: {
      const existingCheckedIn = db.getActiveVisitors().find(v => v.id !== visitor.id && v.idCard === visitor.idCard);
      if (existingCheckedIn) {
        errors.push({ code: 'DUPLICATE_ENTRY', message: '该访客已在机房内，重复入场' });
      }
      
      const now = Date.now();
      if (visitor.approvalStatus !== 'APPROVED') {
        errors.push({ code: EXCEPTION_TYPES.APPROVAL_MISSING, message: '访客未获得审批' });
      }
      if (!visitor.companionConfirmed) {
        errors.push({ code: EXCEPTION_TYPES.COMPANION_ABSENT, message: '陪同人未确认' });
      }
      if (now > visitor.expectedExitTime) {
        errors.push({ code: 'TIME_WINDOW_EXPIRED', message: '已超过预约离场时间' });
      }
      break;
    }
    
    case EVENT_TYPES.CHECK_OUT: {
      const devicesNotCheckedOut = visitor.devices.filter(d => d.checkedIn && !d.checkedOut);
      const explicitLeftBehind = eventData.leftBehindDeviceSerials || [];
      
      if (explicitLeftBehind.length > 0) {
        const invalidSerials = explicitLeftBehind.filter(sn => 
          !visitor.devices.some(d => d.serialNumber === sn)
        );
        if (invalidSerials.length > 0) {
          errors.push({
            code: 'INVALID_DEVICE_SERIAL',
            message: `设备序列号不存在: ${invalidSerials.join(', ')}`
          });
        }
      }
      break;
    }
  }
  
  return errors;
}

function applyEvent(visitor, eventType, eventData, operatorId) {
  const now = Date.now();
  const historyEntry = {
    id: uuidv4(),
    eventType,
    eventData: JSON.parse(JSON.stringify(eventData || {})),
    previousStatus: visitor.status,
    newStatus: visitor.status,
    operatorId: operatorId || eventData.operatorId || 'SYSTEM',
    timestamp: now,
    idempotencyKey: eventData.idempotencyKey || null,
    notes: eventData.notes || ''
  };
  
  const beforeState = JSON.parse(JSON.stringify(visitor));
  
  switch (eventType) {
    case EVENT_TYPES.APPROVE:
      visitor.approvalStatus = 'APPROVED';
      visitor.approverId = eventData.approverId || visitor.approverId;
      visitor.approverName = eventData.approverName;
      visitor.approvalNote = eventData.notes;
      visitor.approvedAt = now;
      visitor.status = VISITOR_STATUS.APPROVED;
      break;
      
    case EVENT_TYPES.REJECT:
      visitor.approvalStatus = 'REJECTED';
      visitor.approverId = eventData.approverId || visitor.approverId;
      visitor.approverName = eventData.approverName;
      visitor.approvalNote = eventData.notes;
      visitor.approvedAt = now;
      visitor.status = VISITOR_STATUS.APPROVAL_REJECTED;
      break;
      
    case EVENT_TYPES.CONFIRM_COMPANION:
      visitor.companionId = eventData.companionId || visitor.companionId;
      visitor.companionName = eventData.companionName;
      visitor.companionConfirmed = true;
      visitor.companionConfirmedAt = now;
      visitor.status = VISITOR_STATUS.COMPANION_CONFIRMED;
      break;
      
    case EVENT_TYPES.COMPANION_ABSENT:
      visitor.companionConfirmed = false;
      visitor.status = VISITOR_STATUS.COMPANION_ABSENT;
      break;
      
    case EVENT_TYPES.CHECK_IN:
      visitor.actualEntryTime = now;
      visitor.devices.forEach(d => {
        d.checkedIn = true;
        d.checkedInAt = now;
      });
      visitor.status = VISITOR_STATUS.CHECKED_IN;
      break;
      
    case EVENT_TYPES.CHECK_OUT: {
      const leftBehindSerials = eventData.leftBehindDeviceSerials || [];
      
      visitor.devices.forEach(d => {
        if (d.checkedIn && !leftBehindSerials.includes(d.serialNumber)) {
          d.checkedOut = true;
          d.checkedOutAt = now;
        }
      });
      
      const devicesLeft = visitor.devices.filter(d => 
        d.checkedIn && !d.checkedOut
      );
      
      if (devicesLeft.length > 0) {
        visitor.status = VISITOR_STATUS.DEVICE_LEFT_BEHIND;
        visitor.exceptions.push({
          id: uuidv4(),
          type: EXCEPTION_TYPES.DEVICE_NOT_CHECKED_OUT,
          message: `设备未带出: ${devicesLeft.map(d => d.serialNumber || d.type).join(', ')}`,
          reportedAt: now,
          reportedBy: operatorId || 'SYSTEM'
        });
      } else {
        visitor.status = VISITOR_STATUS.CHECKED_OUT;
        visitor.actualExitTime = now;
      }
      break;
    }
    
    case EVENT_TYPES.TIMEOUT:
      visitor.status = VISITOR_STATUS.TIMEOUT;
      visitor.exceptions.push({
        id: uuidv4(),
        type: EXCEPTION_TYPES.VISIT_TIMEOUT,
        message: `访客超时未离场，预约离场时间: ${new Date(visitor.expectedExitTime).toISOString()}`,
        reportedAt: now,
        reportedBy: 'SYSTEM'
      });
      break;
      
    case EVENT_TYPES.EXCEPTION_REPORT:
      visitor.exceptions.push({
        id: uuidv4(),
        type: eventData.exceptionType || EXCEPTION_TYPES.UNKNOWN,
        message: eventData.message,
        reportedAt: now,
        reportedBy: operatorId || eventData.operatorId || 'SYSTEM',
        details: eventData.details
      });
      break;
      
    case EVENT_TYPES.MANUAL_CORRECTION:
      if (eventData.newStatus) {
        visitor.status = eventData.newStatus;
      }
      if (eventData.approvalStatus !== undefined) {
        visitor.approvalStatus = eventData.approvalStatus;
      }
      if (eventData.companionConfirmed !== undefined) {
        visitor.companionConfirmed = eventData.companionConfirmed;
      }
      if (eventData.devices) {
        eventData.devices.forEach(update => {
          const device = visitor.devices.find(d => d.id === update.id || d.serialNumber === update.serialNumber);
          if (device) {
            Object.assign(device, update);
          }
        });
      }
      break;
  }
  
  historyEntry.newStatus = visitor.status;
  historyEntry.beforeState = beforeState;
  historyEntry.afterState = JSON.parse(JSON.stringify(visitor));
  
  const diff = calculateDiff(beforeState, visitor);
  if (Object.keys(diff).length > 0) {
    historyEntry.diff = diff;
  }
  
  visitor.history.push(historyEntry);
  visitor.updatedAt = now;
  
  return { visitor, historyEntry };
}

function calculateDiff(before, after) {
  const diff = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of keys) {
    if (key === 'history' || key === 'updatedAt') continue;
    
    const beforeVal = JSON.stringify(before[key]);
    const afterVal = JSON.stringify(after[key]);
    
    if (beforeVal !== afterVal) {
      diff[key] = {
        before: before[key],
        after: after[key]
      };
    }
  }
  
  return diff;
}

module.exports = {
  stateTransitions,
  eventToStatus,
  validateTransition,
  checkBusinessRules,
  applyEvent,
  calculateDiff
};
