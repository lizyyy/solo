const { readRecords, readBatches } = require('./dataStore');

const STATUS = {
  PENDING: 'pending',
  NORMAL: 'normal',
  DUPLICATE_USER: 'duplicate_user',
  NEEDS_REVIEW: 'needs_review',
  MERGED: 'merged',
  EXCLUDED: 'excluded'
};

const STATUS_LABELS = {
  [STATUS.PENDING]: '待处理',
  [STATUS.NORMAL]: '正常',
  [STATUS.DUPLICATE_USER]: '同一用户重复反馈',
  [STATUS.NEEDS_REVIEW]: '待标注负责人复核',
  [STATUS.MERGED]: '已归并',
  [STATUS.EXCLUDED]: '已排除'
};

function checkDuplicateImport(batchId, records, importedRows) {
  const batchRecords = records.filter(r => r.batchId === batchId);
  const issues = [];
  
  importedRows.forEach((row, idx) => {
    const existing = batchRecords.find(r => 
      r.originalLineNumber === idx + 2 && 
      r.questionText === row.question &&
      r.userId === row.user_id
    );
    if (existing) {
      issues.push({
        type: 'duplicate_import',
        severity: 'warning',
        originalLineNumber: idx + 2,
        questionText: row.question,
        message: `第${idx + 2}行疑似重复导入，已存在同批次同用户同问题记录`,
        existingRecordId: existing.id
      });
    }
  });
  
  return issues;
}

function checkDuplicateUserFeedback(records, batchId) {
  const batchRecords = batchId 
    ? records.filter(r => r.batchId === batchId)
    : records;
  
  const userGrouped = {};
  batchRecords.forEach(record => {
    const key = `${record.userId}_${record.questionText.trim().toLowerCase()}`;
    if (!userGrouped[key]) {
      userGrouped[key] = [];
    }
    userGrouped[key].push(record);
  });
  
  const issues = [];
  Object.entries(userGrouped).forEach(([key, group]) => {
    if (group.length > 1) {
      issues.push({
        type: 'duplicate_user',
        severity: 'error',
        userId: group[0].userId,
        questionText: group[0].questionText,
        recordIds: group.map(g => g.id),
        originalLineNumbers: group.map(g => g.originalLineNumber),
        message: `用户${group[0].userId}的相同问题出现${group.length}次，需标注负责人复核`,
        autoStatus: STATUS.DUPLICATE_USER
      });
    }
  });
  
  return issues;
}

function checkMergeConsistency(records, batchId) {
  const batchRecords = batchId 
    ? records.filter(r => r.batchId === batchId)
    : records;
  
  const issues = [];
  
  batchRecords.forEach(record => {
    if (record.mergedIntoId) {
      const targetRecord = records.find(r => r.id === record.mergedIntoId);
      if (!targetRecord) {
        issues.push({
          type: 'merge_target_missing',
          severity: 'error',
          recordId: record.id,
          message: `记录${record.id}归并目标不存在`
        });
      } else if (targetRecord.status === STATUS.EXCLUDED) {
        issues.push({
          type: 'merge_target_excluded',
          severity: 'warning',
          recordId: record.id,
          targetRecordId: targetRecord.id,
          message: `记录${record.id}归并到了已排除的记录`
        });
      }
    }
  });
  
  return issues;
}

function checkExportConsistency(records, batchId) {
  const batchRecords = batchId 
    ? records.filter(r => r.batchId === batchId)
    : records;
  
  const displayCount = batchRecords.filter(r => r.status !== STATUS.EXCLUDED).length;
  const exportableCount = batchRecords.filter(r => 
    r.status !== STATUS.EXCLUDED && r.status !== STATUS.DUPLICATE_USER
  ).length;
  
  return {
    type: 'export_consistency',
    displayCount,
    exportableCount,
    warning: displayCount !== exportableCount 
      ? `页面展示${displayCount}条，实际可导出${exportableCount}条，差异为待复核的重复用户反馈`
      : '展示与导出数量一致'
  };
}

function runFullCheck(batchId) {
  const records = readRecords();
  const batches = readBatches();
  const batch = batches.find(b => b.id === batchId);
  
  const issues = [];
  
  issues.push(...checkDuplicateUserFeedback(records, batchId));
  issues.push(...checkMergeConsistency(records, batchId));
  
  const exportCheck = checkExportConsistency(records, batchId);
  
  const stats = {
    total: records.filter(r => r.batchId === batchId).length,
    normal: records.filter(r => r.batchId === batchId && r.status === STATUS.NORMAL).length,
    duplicateUser: records.filter(r => r.batchId === batchId && r.status === STATUS.DUPLICATE_USER).length,
    needsReview: records.filter(r => r.batchId === batchId && r.status === STATUS.NEEDS_REVIEW).length,
    merged: records.filter(r => r.batchId === batchId && r.status === STATUS.MERGED).length,
    excluded: records.filter(r => r.batchId === batchId && r.status === STATUS.EXCLUDED).length,
    pending: records.filter(r => r.batchId === batchId && r.status === STATUS.PENDING).length
  };
  
  return {
    batchId,
    batchName: batch ? batch.name : null,
    checkedAt: new Date().toISOString(),
    issues,
    exportCheck,
    stats
  };
}

function applyAutoStatus(records, batchId) {
  const issues = checkDuplicateUserFeedback(records, batchId);
  const updatedRecords = [...records];
  
  issues.forEach(issue => {
    issue.recordIds.forEach(recordId => {
      const idx = updatedRecords.findIndex(r => r.id === recordId);
      if (idx !== -1 && updatedRecords[idx].status === STATUS.PENDING) {
        updatedRecords[idx] = {
          ...updatedRecords[idx],
          status: STATUS.DUPLICATE_USER,
          statusUpdatedAt: new Date().toISOString(),
          statusUpdatedBy: 'system_auto_check'
        };
      }
    });
  });
  
  return updatedRecords;
}

module.exports = {
  STATUS,
  STATUS_LABELS,
  checkDuplicateImport,
  checkDuplicateUserFeedback,
  checkMergeConsistency,
  checkExportConsistency,
  runFullCheck,
  applyAutoStatus
};
