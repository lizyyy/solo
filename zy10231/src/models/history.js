const storage = require('../storage');

const OPERATION_TYPES = ['import', 'check', 'confirm', 'reprint', 'checkin', 'update'];

function recordOperation(type, details, batchNumber = null) {
  const history = storage.getHistory();
  const record = {
    id: `H${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
    type,
    batchNumber,
    timestamp: new Date().toISOString(),
    details
  };
  history.push(record);
  storage.saveHistory(history);
  return record;
}

function addPendingItem(item) {
  const pending = storage.getPending();
  const exists = pending.some(p => 
    p.attendeeKey === item.attendeeKey && 
    p.operationType === item.operationType &&
    (!item.badgeNumber || p.badgeNumber === item.badgeNumber)
  );
  
  if (!exists) {
    pending.push({
      ...item,
      id: `P${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
      addedAt: new Date().toISOString()
    });
    storage.savePending(pending);
    return true;
  }
  return false;
}

function getPendingList() {
  return storage.getPending();
}

function clearPendingList() {
  storage.clearPending();
}

function confirmPending(batchNumber, operator = 'system') {
  const pending = storage.getPending();
  if (pending.length === 0) {
    return { success: false, message: '没有待确认的记录' };
  }
  
  const operations = [];
  const attendees = storage.getAttendees();
  
  for (const item of pending) {
    const attendeeIndex = attendees.findIndex(a => a.id === item.attendeeId);
    if (attendeeIndex < 0) continue;
    
    let operationDetail = {
      attendee: {
        id: item.attendeeId,
        name: item.name,
        company: item.company,
        badgeNumber: item.badgeNumber
      },
      operationType: item.operationType
    };
    
    switch (item.operationType) {
      case 'reprint':
        attendees[attendeeIndex].reprintCount = (attendees[attendeeIndex].reprintCount || 0) + 1;
        attendees[attendeeIndex].reprintReasons = [
          ...(attendees[attendeeIndex].reprintReasons || []),
          { reason: item.reprintReason || '未说明', timestamp: new Date().toISOString() }
        ];
        operationDetail.reprintReason = item.reprintReason || '未说明';
        operationDetail.reprintCount = attendees[attendeeIndex].reprintCount;
        break;
        
      case 'update_name':
        operationDetail.oldName = item.oldValue;
        operationDetail.newName = item.newValue;
        attendees[attendeeIndex].name = item.newValue;
        break;
        
      case 'update_company':
        operationDetail.oldCompany = item.oldValue;
        operationDetail.newCompany = item.newValue;
        attendees[attendeeIndex].company = item.newValue;
        break;
        
      case 'update_badge':
        operationDetail.oldBadge = item.oldValue;
        operationDetail.newBadge = item.newValue;
        attendees[attendeeIndex].badgeNumber = item.newValue;
        break;
        
      case 'update_permission':
        operationDetail.oldPermission = item.oldValue;
        operationDetail.newPermission = item.newValue;
        attendees[attendeeIndex].permissionZone = item.newValue;
        break;
        
      case 'checkin':
        attendees[attendeeIndex].checkinStatus = '已签到';
        operationDetail.checkinTime = new Date().toISOString();
        break;
    }
    
    attendees[attendeeIndex].updatedAt = new Date().toISOString();
    operations.push(operationDetail);
  }
  
  storage.saveAttendees(attendees);
  
  const operationsWithFullData = operations.map(op => ({
    ...op,
    attendee: {
      ...attendees.find(a => a.id === op.attendee.id)
    }
  }));
  
  recordOperation('confirm', {
    batchNumber,
    operator,
    itemCount: pending.length,
    operations: operationsWithFullData
  }, batchNumber);
  
  clearPendingList();
  
  return {
    success: true,
    batchNumber,
    itemCount: operations.length,
    operations: operationsWithFullData
  };
}

function findByBatch(batchNumber) {
  const history = storage.getHistory();
  return history.filter(h => h.batchNumber === batchNumber);
}

function findByAttendee(attendeeId) {
  const history = storage.getHistory();
  return history.filter(h => 
    h.details?.attendee?.id === attendeeId ||
    (h.details?.operations && h.details.operations.some(op => op.attendee?.id === attendeeId))
  );
}

function getAllHistory() {
  return storage.getHistory();
}

module.exports = {
  OPERATION_TYPES,
  recordOperation,
  addPendingItem,
  getPendingList,
  clearPendingList,
  confirmPending,
  findByBatch,
  findByAttendee,
  getAllHistory
};
