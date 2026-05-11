const express = require('express');
const cors = require('cors');
const path = require('path');
const models = require('./data/models');
const { initSampleData } = require('./data/sampleData');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

initSampleData();

function validateChangeData(data) {
  if (!data.title || !data.title.trim()) {
    return '变更标题不能为空';
  }
  if (!data.description || !data.description.trim()) {
    return '变更描述不能为空';
  }
  if (!data.type) {
    return '请选择变更类型';
  }
  if (!data.windowStart || !data.windowEnd) {
    return '请选择变更窗口的开始和结束时间';
  }
  if (new Date(data.windowStart) >= new Date(data.windowEnd)) {
    return '变更窗口开始时间必须早于结束时间';
  }
  if (!data.risk) {
    return '请评估风险等级';
  }
  if (!data.rollbackPlan || !data.rollbackPlan.trim()) {
    return '必须填写回退方案';
  }
  if (data.rollbackPlan.trim().length < 20) {
    return '回退方案不够详细，请至少填写20个字符';
  }
  if (!data.ownerId) {
    return '请指定负责人';
  }
  if (!data.assetIds || data.assetIds.length === 0) {
    return '请选择涉及的资产';
  }
  return null;
}

function canEditChange(change) {
  return change.status === models.CHANGE_STATUS.PENDING_APPROVAL || 
         change.status === models.CHANGE_STATUS.DRAFT;
}

function canExecuteChange(change) {
  return change.status === models.CHANGE_STATUS.APPROVED;
}

function canRollbackChange(change) {
  return change.status === models.CHANGE_STATUS.IN_PROGRESS;
}

function getStatusDisplayName(status) {
  const map = {
    [models.CHANGE_STATUS.DRAFT]: '草稿',
    [models.CHANGE_STATUS.PENDING_APPROVAL]: '待审批',
    [models.CHANGE_STATUS.APPROVED]: '已审批',
    [models.CHANGE_STATUS.REJECTED]: '已拒绝',
    [models.CHANGE_STATUS.IN_PROGRESS]: '执行中',
    [models.CHANGE_STATUS.COMPLETED]: '已完成',
    [models.CHANGE_STATUS.ROLLED_BACK]: '已回退'
  };
  return map[status] || status;
}

function getRiskDisplayName(risk) {
  const map = {
    'low': '低风险',
    'medium': '中风险',
    'high': '高风险'
  };
  return map[risk] || risk;
}

function getTypeDisplayName(type) {
  const map = {
    'network': '网络变更',
    'database': '数据库变更',
    'server': '服务器变更',
    'security': '安全变更',
    'other': '其他变更'
  };
  return map[type] || type;
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function enrichChange(change) {
  const user = models.USERS.find(u => u.id === change.ownerId);
  const assets = change.assetIds.map(id => models.ASSETS.find(a => a.id === id)).filter(Boolean);
  
  return {
    ...change,
    owner: user,
    assets,
    statusDisplay: getStatusDisplayName(change.status),
    riskDisplay: getRiskDisplayName(change.risk),
    typeDisplay: getTypeDisplayName(change.type),
    canEdit: canEditChange(change),
    canExecute: canExecuteChange(change),
    canRollback: canRollbackChange(change),
    formattedWindowStart: formatDate(change.windowStart),
    formattedWindowEnd: formatDate(change.windowEnd),
    formattedCreatedAt: formatDate(change.createdAt),
    approvals: change.approvals.map(ap => ({
      ...ap,
      user: models.USERS.find(u => u.id === ap.userId),
      actionDisplay: ap.action === 'approve' ? '审批通过' : '审批拒绝',
      formattedTimestamp: formatDate(ap.timestamp)
    })),
    executionLogs: change.executionLogs.map(log => ({
      ...log,
      user: models.USERS.find(u => u.id === log.userId),
      formattedTimestamp: formatDate(log.timestamp)
    })),
    rollbackRecords: change.rollbackRecords.map(rb => ({
      ...rb,
      user: models.USERS.find(u => u.id === rb.userId),
      formattedTimestamp: formatDate(rb.timestamp)
    }))
  };
}

app.get('/api/users', (req, res) => {
  res.json(models.getUsers());
});

app.get('/api/assets', (req, res) => {
  res.json(models.getAssets());
});

app.get('/api/changes', (req, res) => {
  const { startDate, endDate, ownerId } = req.query;
  
  let changes = models.getAllChanges();
  
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    changes = changes.filter(c => new Date(c.windowStart) >= start);
  }
  
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    changes = changes.filter(c => new Date(c.windowStart) <= end);
  }
  
  if (ownerId) {
    changes = changes.filter(c => c.ownerId === ownerId);
  }
  
  changes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json(changes.map(enrichChange));
});

app.get('/api/changes/:id', (req, res) => {
  const change = models.getChangeById(req.params.id);
  if (!change) {
    return res.status(404).json({ error: '变更不存在' });
  }
  res.json(enrichChange(change));
});

app.post('/api/changes/validate', (req, res) => {
  const validationError = validateChangeData(req.body);
  if (validationError) {
    return res.json({ valid: false, error: validationError });
  }
  
  const windowConflict = models.checkWindowConflict(req.body.windowStart, req.body.windowEnd);
  if (windowConflict.conflict) {
    return res.json({ 
      valid: false, 
      error: '变更窗口与现有变更冲突',
      conflict: windowConflict
    });
  }
  
  const assetConflict = models.checkAssetConflict(
    req.body.assetIds, 
    req.body.windowStart, 
    req.body.windowEnd
  );
  if (assetConflict.conflict) {
    const assetNames = assetConflict.conflictingChange.overlappingAssets
      .map(id => models.ASSETS.find(a => a.id === id)?.name || id)
      .join('、');
    return res.json({ 
      valid: false, 
      error: `资产 [${assetNames}] 在该时间段已被其他变更使用`,
      conflict: assetConflict
    });
  }
  
  res.json({ valid: true });
});

app.post('/api/changes', (req, res) => {
  const validationError = validateChangeData(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  
  const windowConflict = models.checkWindowConflict(req.body.windowStart, req.body.windowEnd);
  if (windowConflict.conflict) {
    return res.status(400).json({ 
      error: '变更窗口与现有变更冲突，请重新选择时间窗口',
      conflict: windowConflict
    });
  }
  
  const assetConflict = models.checkAssetConflict(
    req.body.assetIds, 
    req.body.windowStart, 
    req.body.windowEnd
  );
  if (assetConflict.conflict) {
    const assetNames = assetConflict.conflictingChange.overlappingAssets
      .map(id => models.ASSETS.find(a => a.id === id)?.name || id)
      .join('、');
    return res.status(400).json({ 
      error: `资产 [${assetNames}] 在该时间段已被其他变更使用`,
      conflict: assetConflict
    });
  }
  
  const change = models.createChange(req.body);
  res.json(enrichChange(change));
});

app.put('/api/changes/:id', (req, res) => {
  const existing = models.getChangeById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '变更不存在' });
  }
  
  if (!canEditChange(existing)) {
    return res.status(400).json({ error: '当前状态不允许编辑变更' });
  }
  
  if (existing.status === models.CHANGE_STATUS.IN_PROGRESS && 
      (req.body.windowStart || req.body.windowEnd)) {
    return res.status(400).json({ error: '变更执行中不能修改时间窗口' });
  }
  
  const updateData = req.body;
  if (updateData.windowStart || updateData.windowEnd) {
    const start = updateData.windowStart || existing.windowStart;
    const end = updateData.windowEnd || existing.windowEnd;
    const assetIds = updateData.assetIds || existing.assetIds;
    
    const windowConflict = models.checkWindowConflict(start, end, existing.id);
    if (windowConflict.conflict) {
      return res.status(400).json({ 
        error: '变更窗口与现有变更冲突',
        conflict: windowConflict
      });
    }
    
    const assetConflict = models.checkAssetConflict(assetIds, start, end, existing.id);
    if (assetConflict.conflict) {
      const assetNames = assetConflict.conflictingChange.overlappingAssets
        .map(id => models.ASSETS.find(a => a.id === id)?.name || id)
        .join('、');
      return res.status(400).json({ 
        error: `资产 [${assetNames}] 在该时间段已被其他变更使用`,
        conflict: assetConflict
      });
    }
  }
  
  const updated = models.updateChange(req.params.id, updateData);
  res.json(enrichChange(updated));
});

app.post('/api/changes/:id/approve', (req, res) => {
  const { userId, comment } = req.body;
  const change = models.addApproval(req.params.id, userId, 'approve', comment);
  if (!change) {
    return res.status(404).json({ error: '变更不存在' });
  }
  res.json(enrichChange(change));
});

app.post('/api/changes/:id/reject', (req, res) => {
  const { userId, comment } = req.body;
  const change = models.addApproval(req.params.id, userId, 'reject', comment);
  if (!change) {
    return res.status(404).json({ error: '变更不存在' });
  }
  res.json(enrichChange(change));
});

app.post('/api/changes/:id/start', (req, res) => {
  const { userId } = req.body;
  const change = models.getChangeById(req.params.id);
  
  if (!change) {
    return res.status(404).json({ error: '变更不存在' });
  }
  
  if (change.status !== models.CHANGE_STATUS.APPROVED) {
    return res.status(400).json({ error: '只有已审批的变更才能开始执行' });
  }
  
  const updated = models.startExecution(req.params.id, userId);
  res.json(enrichChange(updated));
});

app.post('/api/changes/:id/complete', (req, res) => {
  const { userId, summary } = req.body;
  const change = models.getChangeById(req.params.id);
  
  if (!change) {
    return res.status(404).json({ error: '变更不存在' });
  }
  
  if (change.status !== models.CHANGE_STATUS.IN_PROGRESS) {
    return res.status(400).json({ error: '只有执行中的变更才能完成' });
  }
  
  const updated = models.completeChange(req.params.id, userId, summary);
  res.json(enrichChange(updated));
});

app.post('/api/changes/:id/rollback', (req, res) => {
  const { userId, reason, summary } = req.body;
  const change = models.getChangeById(req.params.id);
  
  if (!change) {
    return res.status(404).json({ error: '变更不存在' });
  }
  
  if (change.status !== models.CHANGE_STATUS.IN_PROGRESS) {
    return res.status(400).json({ error: '只有执行中的变更才能执行回退' });
  }
  
  const updated = models.rollbackChange(req.params.id, userId, reason, summary);
  res.json(enrichChange(updated));
});

app.get('/api/reports/weekly', (req, res) => {
  const { startDate, endDate } = req.query;
  
  let start, end;
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  }
  
  const report = models.generateWeeklyReport(start, end);
  
  report.byOwnerWithNames = {};
  for (const [ownerId, data] of Object.entries(report.byOwner)) {
    const user = models.USERS.find(u => u.id === ownerId);
    report.byOwnerWithNames[ownerId] = {
      ...data,
      user
    };
  }
  
  report.changes = report.changes.map(c => ({
    ...c,
    statusDisplay: getStatusDisplayName(c.status),
    typeDisplay: getTypeDisplayName(c.type),
    owner: models.USERS.find(u => u.id === c.ownerId)
  }));
  
  res.json(report);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`机房变更窗口台已启动: http://localhost:${PORT}`);
});
