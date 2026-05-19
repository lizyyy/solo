const { differenceInHours } = require('date-fns');
const { loadRecords, loadConfig, updateRecord } = require('./storage');

function checkDuplicateReport(newRecord, existingRecords) {
  const config = loadConfig();
  const windowHours = config.duplicateWindowHours || 4;
  
  const duplicates = existingRecords.filter(record => {
    if (record.id === newRecord.id) return false;
    if (record.pumpRoom !== newRecord.pumpRoom) return false;
    if (record.status === 'closed') return false;
    
    const hoursDiff = differenceInHours(
      new Date(newRecord.createdAt || new Date()),
      new Date(record.createdAt)
    );
    
    return hoursDiff <= windowHours;
  });
  
  if (duplicates.length > 0) {
    return {
      blocked: true,
      reason: `检测到重复报修：该泵房在过去${windowHours}小时内已有${duplicates.length}条未关闭记录`,
      duplicateIds: duplicates.map(r => r.id)
    };
  }
  
  return { blocked: false };
}

function checkTimeoutEscalation() {
  const config = loadConfig();
  const timeoutHours = config.timeoutHours || 24;
  const escalationLevels = config.escalationLevels || ['工程主管', '项目经理', '物业总监'];
  const records = loadRecords();
  
  const escalated = [];
  
  records.forEach(record => {
    if (record.status === 'closed') return;
    
    const hoursOpen = differenceInHours(new Date(), new Date(record.createdAt));
    const currentLevel = record.escalationLevel || 0;
    
    if (hoursOpen >= timeoutHours && currentLevel < escalationLevels.length - 1) {
      const newLevel = currentLevel + 1;
      const updated = updateRecord(record.id, {
        escalationLevel: newLevel,
        escalationHistory: [
          ...(record.escalationHistory || []),
          {
            level: newLevel,
            escalatedTo: escalationLevels[newLevel],
            at: new Date().toISOString(),
            reason: `超时${Math.floor(hoursOpen)}小时未处理，自动升级`
          }
        ]
      });
      escalated.push(updated);
    }
  });
  
  return escalated;
}

function handleReinspectionFailure(recordId, reinspectionResult) {
  const record = loadRecords().find(r => r.id === recordId);
  if (!record) return null;
  
  if (reinspectionResult.passed) {
    return updateRecord(recordId, {
      status: 'closed',
      reinspection: {
        ...reinspectionResult,
        at: new Date().toISOString()
      }
    });
  } else {
    return updateRecord(recordId, {
      status: 'reopen',
      reinspection: {
        ...reinspectionResult,
        at: new Date().toISOString()
      },
      failureHistory: [
        ...(record.failureHistory || []),
        {
          at: new Date().toISOString(),
          reason: reinspectionResult.reason || '复测不合格',
          inspector: reinspectionResult.inspector
        }
      ]
    });
  }
}

function processRecord(record) {
  const existingRecords = loadRecords();
  const duplicateCheck = checkDuplicateReport(record, existingRecords);
  
  if (duplicateCheck.blocked) {
    return {
      action: 'blocked',
      reason: duplicateCheck.reason,
      details: duplicateCheck
    };
  }
  
  return {
    action: 'allowed',
    reason: '符合规则，允许录入',
    record
  };
}

function generateSummary() {
  const records = loadRecords();
  const now = new Date();
  
  const stats = {
    total: records.length,
    open: records.filter(r => r.status === 'open').length,
    closed: records.filter(r => r.status === 'closed').length,
    reopen: records.filter(r => r.status === 'reopen').length,
    escalated: records.filter(r => r.escalationLevel && r.escalationLevel > 0).length,
    needsAttention: records.filter(r => {
      if (r.status === 'closed') return false;
      const hoursOpen = differenceInHours(now, new Date(r.createdAt));
      return hoursOpen >= 24;
    }).length
  };
  
  const byPumpRoom = {};
  const byHandler = {};
  const byAnomalyType = {};
  
  records.forEach(r => {
    byPumpRoom[r.pumpRoom] = (byPumpRoom[r.pumpRoom] || 0) + 1;
    if (r.handler) byHandler[r.handler] = (byHandler[r.handler] || 0) + 1;
    if (r.anomalyType) byAnomalyType[r.anomalyType] = (byAnomalyType[r.anomalyType] || 0) + 1;
  });
  
  return {
    stats,
    byPumpRoom,
    byHandler,
    byAnomalyType
  };
}

module.exports = {
  checkDuplicateReport,
  checkTimeoutEscalation,
  handleReinspectionFailure,
  processRecord,
  generateSummary
};
