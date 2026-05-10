const { db, getNextId, now } = require('./database');

const STATUS_FLOW = {
  pending: { label: '待受理', next: ['inspecting'], color: '#94a3b8' },
  inspecting: { label: '质检中', next: ['inspected', 'rejected'], color: '#f59e0b' },
  inspected: { label: '质检完成', next: ['pricing'], color: '#3b82f6' },
  pricing: { label: '定价中', next: ['listed', 'rejected'], color: '#8b5cf6' },
  listed: { label: '已上架', next: ['sold', 'withdrawn'], color: '#10b981' },
  sold: { label: '已售出', next: [], color: '#059669' },
  rejected: { label: '已拒绝', next: [], color: '#ef4444' },
  withdrawn: { label: '已撤回', next: [], color: '#64748b' }
};

const DEFECT_LEVELS = {
  none: { label: '无瑕疵', score: 100, color: '#10b981' },
  minor: { label: '轻微', score: 85, color: '#f59e0b' },
  moderate: { label: '中度', score: 60, color: '#f97316' },
  severe: { label: '严重', score: 30, color: '#ef4444' }
};

const STANDARD_ACCESSORIES = [
  '机身盖', '镜头后盖', '电池', '充电器', '肩带', '说明书', '包装盒'
];

function generateOrderNo() {
  const n = new Date();
  const dateStr = n.getFullYear().toString() +
    (n.getMonth() + 1).toString().padStart(2, '0') +
    n.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CM${dateStr}${random}`;
}

async function recordHistory(consignmentId, actionType, fieldName = null, oldValue = null, newValue = null, notes = null) {
  await db.read();
  const record = {
    id: getNextId('history'),
    consignment_id: consignmentId,
    action_type: actionType,
    field_name: fieldName,
    old_value: oldValue !== null ? JSON.stringify(oldValue) : null,
    new_value: newValue !== null ? JSON.stringify(newValue) : null,
    operator: 'system',
    notes: notes,
    created_at: now()
  };
  db.data.history.push(record);
  await db.write();
  return record;
}

async function updateConsignmentStatus(consignmentId, newStatus, notes = null) {
  await db.read();
  const consignment = db.data.consignments.find(c => c.id === consignmentId);
  if (!consignment) throw new Error('寄卖单不存在');
  
  const flow = STATUS_FLOW[consignment.status];
  if (flow && !flow.next.includes(newStatus) && consignment.status !== newStatus) {
    throw new Error(`状态流转不允许: ${consignment.status} -> ${newStatus}`);
  }
  
  const oldStatus = consignment.status;
  consignment.status = newStatus;
  consignment.updated_at = now();
  await db.write();
  
  await recordHistory(consignmentId, 'status_change', 'status', oldStatus, newStatus, notes);
  
  return { success: true, oldStatus, newStatus };
}

function getConsignmentStatusInfo(status) {
  return STATUS_FLOW[status] || { label: status, next: [], color: '#94a3b8' };
}

function getDefectLevelInfo(level) {
  return DEFECT_LEVELS[level] || { label: level, score: 0, color: '#94a3b8' };
}

module.exports = {
  STATUS_FLOW,
  DEFECT_LEVELS,
  STANDARD_ACCESSORIES,
  generateOrderNo,
  recordHistory,
  updateConsignmentStatus,
  getConsignmentStatusInfo,
  getDefectLevelInfo
};
