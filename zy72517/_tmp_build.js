const fs = require('fs');
const path = '/Users/lzy/pro/solo/workspaces/zy72517/backend/services/selfCheck.js';
let content = fs.readFileSync(path, 'utf8');

const oldCheckExport = `function checkExportConsistency(records, batchId) {
  var batchRecords = records.filter(function(r) { return r.batchId === batchId; });
  var displayCount = batchRecords.length;
  var exportCount = batchRecords.length;
  return {
    consistent: displayCount === exportCount,
    displayCount: displayCount,
    exportCount: exportCount,
    totalRecords: batchRecords.length,
    hasDuplicateUsers: batchRecords.filter(function(r) { return r.status === STATUS.DUPLICATE_USER; }).length,
    hasNeedsReview: batchRecords.filter(function(r) { return r.status === STATUS.NEEDS_REVIEW; }).length,
    message: "页面展示 " + displayCount + " 条，可导出 " + exportCount + " 条"
  };
}`;

const newCheckExport = `function checkExportConsistency(records, batchId) {
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
}`;

const before = content.length;
content = content.replace(oldCheckExport, newCheckExport);
const after = content.length;
console.log('checkExportConsistency replaced, length change:', after - before);
fs.writeFileSync(path, content);
console.log('File written successfully');
