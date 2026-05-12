const store = require('../data/store');
const { formatDate, now } = require('../utils/date');

function recordHistory(shipmentId, action, operator, details = {}) {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return null;
  }
  
  const history = {
    shipmentId,
    action,
    operator,
    details,
    timestamp: formatDate(now()),
    previousStatus: shipment.status
  };
  
  return store.addHistory(history);
}

function recordStatusChange(shipmentId, newStatus, operator, reason = '', changes = {}) {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return null;
  }
  
  const before = { ...shipment };
  const after = store.updateShipment(shipmentId, {
    status: newStatus,
    statusReason: reason
  });
  
  const diff = calculateDiff(before, after);
  
  return recordHistory(shipmentId, 'status_change', operator, {
    action: 'status_change',
    fromStatus: before.status,
    toStatus: newStatus,
    reason,
    changes,
    diff
  });
}

function recordManualEdit(shipmentId, operator, changes, reason = '') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return null;
  }
  
  const before = { ...shipment };
  const after = store.updateShipment(shipmentId, changes);
  
  const diff = calculateDiff(before, after);
  
  return recordHistory(shipmentId, 'manual_edit', operator, {
    action: 'manual_edit',
    reason,
    before: {
      status: before.status,
      description: before.description
    },
    after: {
      status: after.status,
      description: after.description
    },
    diff
  });
}

function calculateDiff(before, after) {
  const diff = {
    added: {},
    removed: {},
    updated: {}
  };
  
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    if (key === 'updatedAt') continue;
    
    const beforeValue = before[key];
    const afterValue = after[key];
    
    if (typeof beforeValue === 'undefined') {
      diff.added[key] = afterValue;
    } else if (typeof afterValue === 'undefined') {
      diff.removed[key] = beforeValue;
    } else if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff.updated[key] = {
        before: beforeValue,
        after: afterValue
      };
    }
  }
  
  return diff;
}

function getShipmentHistory(shipmentId) {
  return store.getHistoryByShipment(shipmentId);
}

function formatHistoryForDisplay(historyRecords) {
  return historyRecords.map(h => ({
    time: h.timestamp,
    operator: h.operator,
    action: h.action,
    summary: generateSummary(h),
    details: h.details
  }));
}

function generateSummary(history) {
  switch (history.action) {
    case 'created':
      return `异常件创建`;
    case 'status_change':
      return `状态变更: ${history.details.fromStatus} -> ${history.details.toStatus}`;
    case 'evidence_uploaded':
      return `证据上传: ${history.details.evidenceType || '未知类型'}`;
    case 'liability_judged':
      return `责任判定: ${history.details.liabilityResult || '未知'}`;
    case 'compensation_calculated':
      return `赔付计算: ¥${history.details.amount || 0}`;
    case 'review_submitted':
      return `审核提交`;
    case 'review_approved':
      return `审核通过`;
    case 'review_rejected':
      return `审核驳回: ${history.details.reason || '无'}`;
    case 'appeal_submitted':
      return `申诉提交`;
    case 'appeal_approved':
      return `申诉通过`;
    case 'appeal_rejected':
      return `申诉驳回: ${history.details.reason || '无'}`;
    case 'manual_edit':
      return `人工修正: ${history.details.reason || '无'}`;
    case 'callback':
      return `回调处理: ${history.details.callbackType || '未知'}`;
    default:
      return history.action;
  }
}

module.exports = {
  recordHistory,
  recordStatusChange,
  recordManualEdit,
  getShipmentHistory,
  formatHistoryForDisplay,
  calculateDiff
};
