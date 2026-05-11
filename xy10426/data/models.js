const CHANGE_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ROLLED_BACK: 'rolled_back'
};

const ASSET_TYPES = {
  SWITCH: 'switch',
  SERVER: 'server',
  DATABASE: 'database',
  ROUTER: 'router',
  FIREWALL: 'firewall'
};

const USERS = [
  { id: 'u1', name: '张三', role: 'engineer' },
  { id: 'u2', name: '李四', role: 'engineer' },
  { id: 'u3', name: '王五', role: 'approver' },
  { id: 'u4', name: '赵六', role: 'approver' }
];

const ASSETS = [
  { id: 'a1', name: '核心交换机-SW-01', type: ASSET_TYPES.SWITCH, location: 'A区1号机架' },
  { id: 'a2', name: '核心交换机-SW-02', type: ASSET_TYPES.SWITCH, location: 'A区2号机架' },
  { id: 'a3', name: '接入交换机-SW-03', type: ASSET_TYPES.SWITCH, location: 'B区1号机架' },
  { id: 'a4', name: '数据库服务器-DB-01', type: ASSET_TYPES.SERVER, location: 'C区1号机架' },
  { id: 'a5', name: '应用服务器-APP-01', type: ASSET_TYPES.SERVER, location: 'C区2号机架' },
  { id: 'a6', name: '应用服务器-APP-02', type: ASSET_TYPES.SERVER, location: 'C区3号机架' },
  { id: 'a7', name: 'MySQL主库-MYSQL-01', type: ASSET_TYPES.DATABASE, location: 'D区1号机架' },
  { id: 'a8', name: 'MySQL从库-MYSQL-02', type: ASSET_TYPES.DATABASE, location: 'D区2号机架' },
  { id: 'a9', name: '核心路由器-RT-01', type: ASSET_TYPES.ROUTER, location: 'A区1号机架' },
  { id: 'a10', name: '防火墙-FW-01', type: ASSET_TYPES.FIREWALL, location: 'A区3号机架' }
];

let changes = [];
let nextChangeId = 1;

function generateId() {
  return 'C' + String(nextChangeId++).padStart(4, '0');
}

function getUsers() {
  return USERS;
}

function getAssets() {
  return ASSETS;
}

function getChangeById(id) {
  return changes.find(c => c.id === id);
}

function getAllChanges() {
  return [...changes];
}

function createChange(data) {
  const now = new Date();
  const change = {
    id: generateId(),
    title: data.title,
    description: data.description,
    type: data.type,
    status: CHANGE_STATUS.PENDING_APPROVAL,
    assetIds: data.assetIds || [],
    windowStart: new Date(data.windowStart),
    windowEnd: new Date(data.windowEnd),
    risk: data.risk,
    rollbackPlan: data.rollbackPlan,
    ownerId: data.ownerId,
    approvals: [],
    executionLogs: [],
    rollbackRecords: [],
    createdAt: now,
    updatedAt: now
  };
  changes.push(change);
  return change;
}

function updateChange(id, data) {
  const index = changes.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  const change = changes[index];
  changes[index] = {
    ...change,
    ...data,
    updatedAt: new Date()
  };
  return changes[index];
}

function addApproval(changeId, userId, action, comment) {
  const change = getChangeById(changeId);
  if (!change) return null;
  
  change.approvals.push({
    id: 'ap' + Date.now(),
    userId,
    action,
    comment,
    timestamp: new Date()
  });
  
  if (action === 'approve') {
    change.status = CHANGE_STATUS.APPROVED;
  } else if (action === 'reject') {
    change.status = CHANGE_STATUS.REJECTED;
  }
  
  change.updatedAt = new Date();
  return change;
}

function startExecution(changeId, userId) {
  const change = getChangeById(changeId);
  if (!change) return null;
  
  change.status = CHANGE_STATUS.IN_PROGRESS;
  change.executionLogs.push({
    id: 'log' + Date.now(),
    userId,
    action: 'start',
    message: '开始执行变更',
    timestamp: new Date()
  });
  change.updatedAt = new Date();
  return change;
}

function completeChange(changeId, userId, summary) {
  const change = getChangeById(changeId);
  if (!change) return null;
  
  change.status = CHANGE_STATUS.COMPLETED;
  change.executionLogs.push({
    id: 'log' + Date.now(),
    userId,
    action: 'complete',
    message: `变更完成。总结：${summary}`,
    timestamp: new Date()
  });
  change.updatedAt = new Date();
  return change;
}

function rollbackChange(changeId, userId, reason, rollbackSummary) {
  const change = getChangeById(changeId);
  if (!change) return null;
  
  change.status = CHANGE_STATUS.ROLLED_BACK;
  change.rollbackRecords.push({
    id: 'rb' + Date.now(),
    userId,
    reason,
    summary: rollbackSummary,
    timestamp: new Date()
  });
  change.executionLogs.push({
    id: 'log' + Date.now(),
    userId,
    action: 'rollback',
    message: `执行回退。原因：${reason}。总结：${rollbackSummary}`,
    timestamp: new Date()
  });
  change.updatedAt = new Date();
  return change;
}

function addExecutionLog(changeId, userId, action, message) {
  const change = getChangeById(changeId);
  if (!change) return null;
  
  change.executionLogs.push({
    id: 'log' + Date.now(),
    userId,
    action,
    message,
    timestamp: new Date()
  });
  change.updatedAt = new Date();
  return change;
}

function deleteChange(id) {
  const index = changes.findIndex(c => c.id === id);
  if (index === -1) return false;
  changes.splice(index, 1);
  return true;
}

function checkWindowConflict(windowStart, windowEnd, excludeChangeId = null) {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  
  for (const change of changes) {
    if (excludeChangeId && change.id === excludeChangeId) continue;
    if (change.status === CHANGE_STATUS.REJECTED || change.status === CHANGE_STATUS.DRAFT) continue;
    
    const changeStart = new Date(change.windowStart);
    const changeEnd = new Date(change.windowEnd);
    
    if (start < changeEnd && end > changeStart) {
      return {
        conflict: true,
        conflictingChange: {
          id: change.id,
          title: change.title,
          windowStart: change.windowStart,
          windowEnd: change.windowEnd
        }
      };
    }
  }
  
  return { conflict: false };
}

function checkAssetConflict(assetIds, windowStart, windowEnd, excludeChangeId = null) {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  
  for (const change of changes) {
    if (excludeChangeId && change.id === excludeChangeId) continue;
    if (change.status === CHANGE_STATUS.REJECTED || change.status === CHANGE_STATUS.DRAFT) continue;
    
    const changeStart = new Date(change.windowStart);
    const changeEnd = new Date(change.windowEnd);
    
    if (start < changeEnd && end > changeStart) {
      const overlappingAssets = change.assetIds.filter(id => assetIds.includes(id));
      
      if (overlappingAssets.length > 0) {
        return {
          conflict: true,
          conflictingChange: {
            id: change.id,
            title: change.title,
            windowStart: change.windowStart,
            windowEnd: change.windowEnd,
            overlappingAssets
          }
        };
      }
    }
  }
  
  return { conflict: false };
}

function generateWeeklyReport(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const reportChanges = changes.filter(c => {
    const created = new Date(c.createdAt);
    return created >= start && created <= end;
  });
  
  const stats = {
    total: reportChanges.length,
    pendingApproval: reportChanges.filter(c => c.status === CHANGE_STATUS.PENDING_APPROVAL).length,
    approved: reportChanges.filter(c => c.status === CHANGE_STATUS.APPROVED).length,
    rejected: reportChanges.filter(c => c.status === CHANGE_STATUS.REJECTED).length,
    inProgress: reportChanges.filter(c => c.status === CHANGE_STATUS.IN_PROGRESS).length,
    completed: reportChanges.filter(c => c.status === CHANGE_STATUS.COMPLETED).length,
    rolledBack: reportChanges.filter(c => c.status === CHANGE_STATUS.ROLLED_BACK).length
  };
  
  const byOwner = {};
  reportChanges.forEach(c => {
    if (!byOwner[c.ownerId]) {
      byOwner[c.ownerId] = { count: 0, changes: [] };
    }
    byOwner[c.ownerId].count++;
    byOwner[c.ownerId].changes.push({
      id: c.id,
      title: c.title,
      status: c.status
    });
  });
  
  return {
    startDate,
    endDate,
    stats,
    byOwner,
    changes: reportChanges.map(c => ({
      id: c.id,
      title: c.title,
      type: c.type,
      status: c.status,
      ownerId: c.ownerId,
      windowStart: c.windowStart,
      windowEnd: c.windowEnd,
      rollbackCount: c.rollbackRecords.length
    }))
  };
}

module.exports = {
  CHANGE_STATUS,
  ASSET_TYPES,
  USERS,
  ASSETS,
  getUsers,
  getAssets,
  getChangeById,
  getAllChanges,
  createChange,
  updateChange,
  addApproval,
  startExecution,
  completeChange,
  rollbackChange,
  addExecutionLog,
  deleteChange,
  checkWindowConflict,
  checkAssetConflict,
  generateWeeklyReport
};
