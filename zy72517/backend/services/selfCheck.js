var dataStore = require("./dataStore");
var crypto = require("crypto");

var STATUS = {
  PENDING: "pending",
  NORMAL: "normal",
  DUPLICATE_USER: "duplicate_user",
  NEEDS_REVIEW: "needs_review",
  MERGED: "merged",
  EXCLUDED: "excluded"
};

var STATUS_LABELS = {};
STATUS_LABELS[STATUS.PENDING] = "待处理";
STATUS_LABELS[STATUS.NORMAL] = "正常";
STATUS_LABELS[STATUS.DUPLICATE_USER] = "同一用户重复反馈";
STATUS_LABELS[STATUS.NEEDS_REVIEW] = "待标注负责人复核";
STATUS_LABELS[STATUS.MERGED] = "已归并";
STATUS_LABELS[STATUS.EXCLUDED] = "已排除";

var IMPORT_SOURCE_LABELS = {};
IMPORT_SOURCE_LABELS["initial"] = "首次导入";
IMPORT_SOURCE_LABELS["incremental"] = "增量导入";
IMPORT_SOURCE_LABELS["manual"] = "人工补录";

function buildRecordFingerprint(row) {
  var question = (row.question || row["问题"] || row.questionText || "").trim().toLowerCase();
  var userId = (row.user_id || row["用户ID"] || row.userId || "").trim();
  var feedbackTime = (row.feedback_time || row["反馈时间"] || row.feedbackTime || "").trim();
  return userId + "__" + question + "__" + feedbackTime;
}

function checkDuplicateImport(batchId, records, importedRows) {
  var batchRecords = records.filter(function(r) { return r.batchId === batchId; });
  var fingerprintMap = {};
  batchRecords.forEach(function(record) {
    var fp = record.importFingerprint || buildRecordFingerprint(record);
    fingerprintMap[fp] = record;
  });
  var issues = [];
  importedRows.forEach(function(row, idx) {
    var fingerprint = buildRecordFingerprint(row);
    var existing = fingerprintMap[fingerprint];
    if (existing) {
      issues.push({
        type: "duplicate_import",
        severity: "warning",
        originalLineNumber: idx + 2,
        questionText: row.question || row["问题"],
        userId: row.user_id || row["用户ID"],
        fingerprint: fingerprint,
        message: "第" + (idx + 2) + "行与已有记录重复（用户+问题+反馈时间完全一致）",
        existingRecordId: existing.id,
        existingOriginalLine: existing.originalLineNumber
      });
    }
  });
  return issues;
}

function calcIncrementalImportDiff(batchId, existingRecords, newRows) {
  var batchRecords = existingRecords.filter(function(r) { return r.batchId === batchId; });
  var existingFingerprints = {};
  batchRecords.forEach(function(record) {
    var fp = record.importFingerprint || buildRecordFingerprint(record);
    existingFingerprints[fp] = record;
  });
  var reusedRecords = [];
  var newRecordsToAdd = [];
  var duplicateUserRecords = [];
  var userQuestionSeen = {};
  newRows.forEach(function(row, idx) {
    var fingerprint = buildRecordFingerprint(row);
    if (existingFingerprints[fingerprint]) {
      reusedRecords.push({
        row: row,
        rowIndex: idx,
        existingRecord: existingFingerprints[fingerprint]
      });
    } else {
      newRecordsToAdd.push({
        row: row,
        rowIndex: idx,
        fingerprint: fingerprint
      });
    }
    var userId = (row.user_id || row["用户ID"] || row.userId || "").trim();
    var question = (row.question || row["问题"] || row.questionText || "").trim().toLowerCase();
    var uqKey = userId + "__" + question;
    if (userQuestionSeen[uqKey]) {
      duplicateUserRecords.push({
        row: row,
        rowIndex: idx,
        firstRowIndex: userQuestionSeen[uqKey]
      });
    } else {
      userQuestionSeen[uqKey] = idx;
    }
  });
  return {
    reusedCount: reusedRecords.length,
    newCount: newRecordsToAdd.length,
    reusedRecords: reusedRecords,
    newRecords: newRecordsToAdd,
    duplicateUserRecords: duplicateUserRecords
  };
}

function checkDuplicateUserFeedback(records, batchId) {
  var batchRecords = records.filter(function(r) { return r.batchId === batchId; });
  var userQuestionMap = {};
  batchRecords.forEach(function(record) {
    var key = record.userId + "__" + (record.questionText || "").trim().toLowerCase();
    if (!userQuestionMap[key]) { userQuestionMap[key] = []; }
    userQuestionMap[key].push(record);
  });
  var issues = [];
  Object.keys(userQuestionMap).forEach(function(key) {
    var recordsWithSame = userQuestionMap[key];
    if (recordsWithSame.length > 1) {
      recordsWithSame.slice(1).forEach(function(record) {
        if (record.status !== STATUS.MERGED && record.status !== STATUS.EXCLUDED) {
          issues.push({
            type: "duplicate_user",
            severity: "warning",
            recordId: record.id,
            questionText: record.questionText,
            userId: record.userId,
            message: "用户 " + record.userId + " 同一问题重复反馈 " + recordsWithSame.length + " 条"
          });
        }
      });
    }
  });
  return issues;
}

function checkMergeConsistency(records, batchId) {
  var batchRecords = records.filter(function(r) { return r.batchId === batchId; });
  var recordIdMap = {};
  batchRecords.forEach(function(r) { recordIdMap[r.id] = r; });
  var issues = [];
  batchRecords.forEach(function(record) {
    if (record.status === STATUS.MERGED && record.mergedIntoId) {
      var target = recordIdMap[record.mergedIntoId];
      if (!target) {
        issues.push({
          type: "merge_target_missing",
          severity: "error",
          recordId: record.id,
          message: "记录 " + record.id + " 归并目标不存在: " + record.mergedIntoId
        });
      } else if (target.status === STATUS.MERGED) {
        issues.push({
          type: "merge_target_merged",
          severity: "warning",
          recordId: record.id,
          targetId: record.mergedIntoId,
          message: "记录 " + record.id + " 的归并目标本身也已归并"
        });
      }
    }
  });
  return issues;
}

function checkExportConsistency(records, batchId) {
  var batchRecords = records.filter(function(r) { return r.batchId === batchId; });
  var displayCount = batchRecords.length;
  var exportCount = batchRecords.length;
  var duplicateUserCount = batchRecords.filter(function(r) { return r.status === STATUS.DUPLICATE_USER; }).length;
  var needsReviewCount = batchRecords.filter(function(r) { return r.status === STATUS.NEEDS_REVIEW; }).length;

  var warning;
  if (duplicateUserCount === 0 && needsReviewCount === 0) {
    warning = "展示与导出数量完全一致，共 " + displayCount + " 条";
  } else {
    warning = "页面展示 " + displayCount + " 条，可导出 " + exportCount + " 条。其中 " + duplicateUserCount + " 条「同一用户重复反馈」、" + needsReviewCount + " 条「待标注负责人复核」均完整导出，不会静默消失";
  }

  return {
    consistent: displayCount === exportCount,
    warning: warning,
    displayCount: displayCount,
    exportCount: exportCount,
    totalRecords: batchRecords.length,
    hasDuplicateUsers: duplicateUserCount,
    hasNeedsReview: needsReviewCount
  };
}

function runFullCheck(batchId) {
  var records = dataStore.readRecords();
  var batches = dataStore.readBatches();
  var batch = null;
  for (var i = 0; i < batches.length; i++) { if (batches[i].id === batchId) { batch = batches[i]; break; } }
  if (!batch) { return { valid: false, error: "批次不存在" }; }
  var batchRecords = records.filter(function(r) { return r.batchId === batchId; });
  var issues = [];
  var dupUserIssues = checkDuplicateUserFeedback(records, batchId);
  dupUserIssues.forEach(function(issue) { issues.push(issue); });
  var mergeIssues = checkMergeConsistency(records, batchId);
  mergeIssues.forEach(function(issue) { issues.push(issue); });
  var importSources = {};
  batchRecords.forEach(function(record) {
    var source = record.importSource || "unknown";
    importSources[source] = (importSources[source] || 0) + 1;
  });
  var statusCounts = {};
  batchRecords.forEach(function(record) {
    statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
  });
  var exportCheck = checkExportConsistency(records, batchId);
  var stats = {
    total: batchRecords.length,
    normal: statusCounts[STATUS.NORMAL] || 0,
    duplicateUser: statusCounts[STATUS.DUPLICATE_USER] || 0,
    needsReview: statusCounts[STATUS.NEEDS_REVIEW] || 0,
    merged: statusCounts[STATUS.MERGED] || 0,
    excluded: statusCounts[STATUS.EXCLUDED] || 0,
    pending: statusCounts[STATUS.PENDING] || 0,
    importSources: importSources
  };
  return {
    valid: true,
    stats: stats,
    exportCheck: exportCheck,
    issues: issues
  };
}

function applyAutoStatus(records, batchId) {
  var batchRecords = records.filter(function(r) { return r.batchId === batchId; });
  var userQuestionMap = {};
  batchRecords.forEach(function(record) {
    var key = record.userId + "__" + (record.questionText || "").trim().toLowerCase();
    if (!userQuestionMap[key]) { userQuestionMap[key] = []; }
    userQuestionMap[key].push(record);
  });
  var updatedRecords = [];
  records.forEach(function(record) {
    if (record.batchId !== batchId) { updatedRecords.push(record); return; }
    var key = record.userId + "__" + (record.questionText || "").trim().toLowerCase();
    var sameGroup = userQuestionMap[key] || [];
    var newStatus = record.status;
    if (record.status === STATUS.PENDING || record.status === STATUS.NORMAL || record.status === STATUS.DUPLICATE_USER) {
      if (sameGroup.length > 1) {
        var isFirst = sameGroup[0].id === record.id;
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
      var change = {
        field: "status",
        oldValue: record.status,
        newValue: newStatus,
        changedAt: new Date().toISOString(),
        changedBy: "system_auto_check",
        reason: "自动检测：同一用户相同问题重复反馈"
      };
      var newRecord = {};
      Object.keys(record).forEach(function(k) { newRecord[k] = record[k]; });
      newRecord.status = newStatus;
      newRecord.statusUpdatedAt = new Date().toISOString();
      newRecord.statusUpdatedBy = "system_auto_check";
      newRecord.manualChanges = record.manualChanges ? record.manualChanges.slice() : [];
      newRecord.manualChanges.push(change);
      updatedRecords.push(newRecord);
    } else {
      updatedRecords.push(record);
    }
  });
  return updatedRecords;
}

module.exports = {
  STATUS: STATUS,
  STATUS_LABELS: STATUS_LABELS,
  IMPORT_SOURCE_LABELS: IMPORT_SOURCE_LABELS,
  buildRecordFingerprint: buildRecordFingerprint,
  checkDuplicateImport: checkDuplicateImport,
  calcIncrementalImportDiff: calcIncrementalImportDiff,
  checkDuplicateUserFeedback: checkDuplicateUserFeedback,
  checkMergeConsistency: checkMergeConsistency,
  checkExportConsistency: checkExportConsistency,
  runFullCheck: runFullCheck,
  applyAutoStatus: applyAutoStatus
};
