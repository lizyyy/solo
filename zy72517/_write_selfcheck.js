const fs = require('fs');
const path = require('path');

const content = `const { readRecords, readBatches } = require('./dataStore');

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

const IMPORT_SOURCE_LABELS = {
  initial: '首次导入',
  incremental: '增量导入',
  manual: '人工补录'
};

function buildRecordFingerprint(row) {
  const question = (row.question || row.\u95ee\u9898 || row.questionText || '').trim().toLowerCase();
  const userId = (row.user_id || row.\u7528\u6237ID || row.userId || '').trim();
  const feedbackTime = (row.feedback_time || row.\u53cd\u9988\u65f6\u95f4 || row.feedbackTime || '').trim();
  return userId + '__' + question + '__' + feedbackTime;
}

function calcIncrementalImportDiff(batchId, existingRecords, newRows) {
  const batchRecords = existingRecords.filter(r => r.batchId === batchId);
  const existingFingerprints = new Map();
  
  batchRecords.forEach(record => {
    const fp = record.importFingerprint || buildRecordFingerprint(record);
    existingFingerprints.set(fp, record);
  });
  
  const reusedRecords = [];
  const newRecordsToAdd = [];
  
  newRows.forEach((row, idx) => {
    const fingerprint = buildRecordFingerprint(row);
    if (existingFingerprints.has(fingerprint)) {
      reusedRecords.push({
        row,
        rowIndex: idx,
        existingRecord: existingFingerprints.get(fingerprint)
      });
    } else {
      newRecordsToAdd.push({
        row,
        rowIndex: idx,
        fingerprint
      });
    }
  });
  
  return {
    reusedCount: reusedRecords.length,
    newCount: newRecordsToAdd.length,
    reusedRecords,
    newRecordsToAdd
  };
}

function checkDuplicateImport(batchId, records, importedRows) {
  const batchRecords = records.filter(r => r.batchId === batchId);
  const fingerprintMap = new Map();
  
  batchRecords.forEach(record => {
    const fp = record.importFingerprint || buildRecordFingerprint(record);
    fingerprintMap.set(fp, record);
  });
  
  const issues = [];
  importedRows.forEach((row, idx) => {
    const fingerprint = buildRecordFingerprint(row);
    const existing = fingerprintMap.get(fingerprint);
    if (existing) {
      issues.push({
        type: 'duplicate_import',
        severity: 'warning',
        originalLineNumber: idx + 2,
        questionText: row.question || row.\u95ee\u9898,
        userId: row.user_id || row.\u7528\u6237ID,
        fingerprint,
        message: '\u7b2c' + (idx + 2) + '\u884c\u4e0e\u5df2\u6709\u8bb0\u5f55\u91cd\u590d\uff08\u7528\u6237+\u95ee\u9898+\u53cd\u9988\u65f6\u95f4\u5b8c\u5168\u4e00\u81f4\uff09',
        existingRecordId: existing.id,
        existingOriginalLine: existing.originalLineNumber
      });
    }
  });
  return issues;
}

function checkExportConsistency(batchId) {
  const records = readRecords();
  const batches = readBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch) {
    return {
      consistent: false,
      error: '\u6279\u6b21\u4e0d\u5b58\u5728'
    };
  }
  
  const batchRecords = records.filter(r => r.batchId === batchId);
  const displayCount = batchRecords.length;
  
  const exportableRecords = batchRecords.filter(r => 
    r.status !== STATUS.MERGED || r.status === STATUS.MERGED
  );
  
  const exportCount = exportableRecords.length;
  
  return {
    consistent: displayCount === exportCount,
    displayCount,
    exportCount,
    totalRecords: batchRecords.length,
    hasDuplicateUsers: batchRecords.filter(r => r.status === STATUS.DUPLICATE_USER).length
  };
}

function runFullCheck(batchId) {
  const records = readRecords();
  const batches = readBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch) {
    return {
      valid: false,
      error: '\u6279\u6b21\u4e0d\u5b58\u5728'
    };
  }
  
  const batchRecords = records.filter(r => r.batchId === batchId);
  
  const issues = [];
  
  const userQuestionMap = new Map();
  batchRecords.forEach(record => {
    const key = record.userId + '__' + record.questionText.trim().toLowerCase();
    if (!userQuestionMap.has(key)) {
      userQuestionMap.set(key, []);
    }
    userQuestionMap.get(key).push(record);
  });
  
  let duplicateUserCount = 0;
  userQuestionMap.forEach((recordsWithSame, key) => {
    if (recordsWithSame.length > 1) {
      duplicateUserCount += recordsWithSame.length - 1;
      recordsWithSame.slice(1).forEach(record => {
        if (record.status !== STATUS.MERGED && record.status !== STATUS.EXCLUDED) {
          issues.push({
            type: 'duplicate_user',
            severity: 'warning',
            recordId: record.id,
            questionText: record.questionText,
            userId: record.userId,
            message: '\u7528\u6237 ' + record.userId + ' \u540c\u4e00\u95ee\u9898\u91cd\u590d\u53cd\u9988 ' + recordsWithSame.length + ' \u6761'
          });
        }
      });
    }
  });
  
  const importSources = {};
  batchRecords.forEach(record => {
    const source = record.importSource || 'unknown';
    importSources[source] = (importSources[source] || 0) + 1;
  });
  
  const statusCounts = {};
  batchRecords.forEach(record => {
    statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
  });
  
  const consistency = checkExportConsistency(batchId);
  
  return {
    valid: true,
    batchId,
    batchName: batch.name,
    totalRecords: batchRecords.length,
    issues,
    issueCount: issues.length,
    duplicateUserCount,
    statusCounts,
    importSources,
    exportConsistency: consistency
  };
}

function applyAutoStatus(records, batchId) {
  const batchRecords = records.filter(r => r.batchId === batchId);
  
  const userQuestionMap = new Map();
  batchRecords.forEach(record => {
    const key = record.userId + '__' + record.questionText.trim().toLowerCase();
    if (!userQuestionMap.has(key)) {
      userQuestionMap.set(key, []);
    }
    userQuestionMap.get(key).push(record);
  });
  
  const updatedRecords = records.map(record => {
    if (record.batchId !== batchId) {
      return record;
    }
    
    const key = record.userId + '__' + record.questionText.trim().toLowerCase();
    const sameGroup = userQuestionMap.get(key) || [];
    
    let newStatus = record.status;
    
    if (record.status === STATUS.PENDING || record.status === STATUS.NORMAL || record.status === STATUS.DUPLICATE_USER) {
      if (sameGroup.length > 1) {
        const isFirst = sameGroup[0].id === record.id;
        if (!isFirst && record.status !== STATUS.MERGED && record.status !== STATUS.EXCLUDED) {
          newStatus = STATUS.DUPLICATE_USER;
        } else if (isFirst && record.status === STATUS.DUPLICATE_USER) {
          newStatus = STATUS.NORMAL;
        }
      } else if (record.status === STATUS.DUPLICATE_USER) {
        newStatus = STATUS.NORMAL;
      }
    }
    
    if (newStatus !== record.status) {
      const changes = [
        {
          field: 'status',
          oldValue: record.status,
          newValue: newStatus,
          changedAt: new Date().toISOString(),
          changedBy: 'system_auto_check'
        }
      ];
      
      return {
        ...record,
        status: newStatus,
        statusUpdatedAt: new Date().toISOString(),
        statusUpdatedBy: 'system_auto_check',
        manualChanges: [...(record.manualChanges || []), ...changes]
      };
    }
    
    return record;
  });
  
  return updatedRecords;
}

module.exports = {
  STATUS,
  STATUS_LABELS,
  IMPORT_SOURCE_LABELS,
  buildRecordFingerprint,
  calcIncrementalImportDiff,
  checkDuplicateImport,
  checkExportConsistency,
  runFullCheck,
  applyAutoStatus
};
`;

fs.writeFileSync(path.join(__dirname, 'backend/services/selfCheck.js'), content);
console.log('selfCheck.js written successfully');
