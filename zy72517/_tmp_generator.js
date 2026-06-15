var fs = require('fs');
var baseDir = '/Users/lzy/pro/solo/workspaces/zy72517';

function countLines(str) {
  return str.split('\n').length;
}

var selfCheckContent = 'var dataStore = require(\'./dataStore\');\n' +
'var readRecords = dataStore.readRecords;\n' +
'var readBatches = dataStore.readBatches;\n' +
'\n' +
'var STATUS = {\n' +
'  PENDING: \'pending\',\n' +
'  NORMAL: \'normal\',\n' +
'  DUPLICATE_USER: \'duplicate_user\',\n' +
'  NEEDS_REVIEW: \'needs_review\',\n' +
'  MERGED: \'merged\',\n' +
'  EXCLUDED: \'excluded\'\n' +
'};\n' +
'\n' +
'var STATUS_LABELS = {};\n' +
'STATUS_LABELS[STATUS.PENDING] = \'待处理\';\n' +
'STATUS_LABELS[STATUS.NORMAL] = \'正常\';\n' +
'STATUS_LABELS[STATUS.DUPLICATE_USER] = \'同一用户重复反馈\';\n' +
'STATUS_LABELS[STATUS.NEEDS_REVIEW] = \'待标注负责人复核\';\n' +
'STATUS_LABELS[STATUS.MERGED] = \'已归并\';\n' +
'STATUS_LABELS[STATUS.EXCLUDED] = \'已排除\';\n' +
'\n' +
'var IMPORT_SOURCE_LABELS = {\n' +
'  initial: \'首次导入\',\n' +
'  incremental: \'增量导入\',\n' +
'  manual: \'人工补录\'\n' +
'};\n' +
'\n' +
'function buildRecordFingerprint(row) {\n' +
'  var question = (row.question || row.问题 || row.questionText || \'\').trim().toLowerCase();\n' +
'  var userId = (row.user_id || row.用户ID || row.userId || \'\').trim();\n' +
'  var feedbackTime = (row.feedback_time || row.反馈时间 || row.feedbackTime || \'\').trim();\n' +
'  return userId + \'__\' + question + \'__\' + feedbackTime;\n' +
'}\n' +
'\n' +
'function checkDuplicateImport(batchId, records, importedRows) {\n' +
'  var batchRecords = records.filter(function(r) { return r.batchId === batchId; });\n' +
'  var fingerprintMap = {};\n' +
'\n' +
'  batchRecords.forEach(function(record) {\n' +
'    var fp = record.importFingerprint || buildRecordFingerprint(record);\n' +
'    fingerprintMap[fp] = record;\n' +
'  });\n' +
'\n' +
'  var issues = [];\n' +
'  importedRows.forEach(function(row, idx) {\n' +
'    var fingerprint = buildRecordFingerprint(row);\n' +
'    var existing = fingerprintMap[fingerprint];\n' +
'    if (existing) {\n' +
'      issues.push({\n' +
'        type: \'duplicate_import\',\n' +
'        severity: \'warning\',\n' +
'        originalLineNumber: idx + 2,\n' +
'        questionText: row.question || row.问题,\n' +
'        userId: row.user_id || row.用户ID,\n' +
'        fingerprint: fingerprint,\n' +
'        message: \'第\' + (idx + 2) + \'行与已有记录重复（用户+问题+反馈时间完全一致）\',\n' +
'        existingRecordId: existing.id,\n' +
'        existingOriginalLine: existing.originalLineNumber\n' +
'      });\n' +
'    }\n' +
'  });\n' +
'  return issues;\n' +
'}\n' +
'\n' +
'function calcIncrementalImportDiff(batchId, existingRecords, newRows) {\n' +
'  var batchRecords = existingRecords.filter(function(r) { return r.batchId === batchId; });\n' +
'  var existingFingerprints = {};\n' +
'\n' +
'  batchRecords.forEach(function(record) {\n' +
'    var fp = record.importFingerprint || buildRecordFingerprint(record);\n' +
'    existingFingerprints[fp] = record;\n' +
'  });\n' +
'\n' +
'  var reusedRecords = [];\n' +
'  var newRecordsToAdd = [];\n' +
'  var duplicateUserRecords = [];\n' +
'\n' +
'  newRows.forEach(function(row, idx) {\n' +
'    var fingerprint = buildRecordFingerprint(row);\n' +
'    if (existingFingerprints[fingerprint]) {\n' +
'      reusedRecords.push({\n' +
'        row: row,\n' +
'        rowIndex: idx,\n' +
'        existingRecord: existingFingerprints[fingerprint]\n' +
'      });\n' +
'    } else {\n' +
'      newRecordsToAdd.push({\n' +
'        row: row,\n' +
'        rowIndex: idx,\n' +
'        fingerprint: fingerprint\n' +
'      });\n' +
'    }\n' +
'  });\n' +
'\n' +
'  return {\n' +
'    reusedCount: reusedRecords.length,\n' +
'    newCount: newRecordsToAdd.length,\n' +
'    reusedRecords: reusedRecords,\n' +
'    newRecords: newRecordsToAdd,\n' +
'    duplicateUserRecords: duplicateUserRecords\n' +
'  };\n' +
'}\n';

console.log('part1 done, len:', selfCheckContent.length);
fs.writeFileSync(baseDir + '/_sc_part1.txt', selfCheckContent);
