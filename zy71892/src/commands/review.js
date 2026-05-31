const { loadRecords, saveRecords, findRecord, addHistoryEntry, loadHistory } = require('../utils/storage');

function reviewRecord(dataDir, recordId) {
  const records = loadRecords(dataDir);
  const record = findRecord(records, recordId);

  if (!record) {
    console.error('未找到记录: ' + recordId);
    process.exit(1);
  }

  console.log('=== 记录详情 ===');
  console.log('ID: ' + record.id);
  console.log('状态: ' + record.status);
  console.log('类型: ' + record.type);
  console.log('日期: ' + record.date);
  console.log('车组: ' + record.trainNo);
  console.log('车厢: ' + record.carriageNo);
  console.log('制动位置: ' + (record.brakePosition || '-'));
  console.log('温度: ' + record.temperature + '°C');
  console.log('报警级别: ' + (record.alarmLevel || '-'));
  if (record.alarmSource) {
    console.log('报警来源: ' + record.alarmSource);
  }
  if (record.operator) {
    console.log('记录人: ' + record.operator);
  }
  if (record.notes) {
    console.log('备注: ' + record.notes);
  }
  console.log('================');

  if (record.status === 'pending') {
    record.status = 'reviewed';
    record.reviewedAt = new Date().toISOString();
    saveRecords(dataDir, records);
    addHistoryEntry(dataDir, recordId, 'review', {
      action: 'marked_as_reviewed'
    }, 'reviewer');
    console.log('已标记为已复核');
  } else {
    console.log('当前状态: ' + record.status);
  }
}

function correctRecord(dataDir, recordId, options) {
  const records = loadRecords(dataDir);
  const record = findRecord(records, recordId);

  if (!record) {
    console.error('未找到记录: ' + recordId);
    process.exit(1);
  }

  if (!options.field || options.value === undefined) {
    console.error('请指定要修正的字段和新值: -f 字段名 -v 新值');
    console.log('可修正字段: temperature, brakePosition, notes, alarmLevel, alarmSource');
    process.exit(1);
  }

  const allowedFields = ['temperature', 'brakePosition', 'notes', 'alarmLevel', 'alarmSource', 'shift', 'operator', 'nextAction', 'confirmedBy', 'confirmSource'];
  if (allowedFields.indexOf(options.field) === -1) {
    console.error('不允许修改字段: ' + options.field);
    console.log('允许字段: ' + allowedFields.join(', '));
    process.exit(1);
  }

  var oldValue = record[options.field];
  var newValue = options.value;

  if (options.field === 'temperature') {
    newValue = parseFloat(newValue);
    if (isNaN(newValue)) {
      console.error('温度必须是数字');
      process.exit(1);
    }
  }

  const history = loadHistory(dataDir);
  var recordHistory = history[recordId] || [];
  var previousCorrections = 0;
  for (var i = 0; i < recordHistory.length; i++) {
    if (recordHistory[i].action === 'correct') {
      previousCorrections++;
    }
  }

  record[options.field] = newValue;
  record.status = 'corrected';
  record.correctionCount = previousCorrections + 1;
  record.updatedAt = new Date().toISOString();

  if (record.corrections) {
    record.corrections.push({
      field: options.field,
      oldValue: oldValue,
      newValue: newValue,
      timestamp: new Date().toISOString()
    });
  } else {
    record.corrections = [{
      field: options.field,
      oldValue: oldValue,
      newValue: newValue,
      timestamp: new Date().toISOString()
    }];
  }

  saveRecords(dataDir, records);

  var engineer = options.engineer || 'unknown';
  
  addHistoryEntry(dataDir, recordId, 'correct', {
    field: options.field,
    oldValue: oldValue,
    newValue: newValue,
    reason: options.reason || '未说明',
    correctionNumber: previousCorrections + 1
  }, 'engineer:' + engineer);

  console.log('修正成功: ' + recordId);
  console.log('字段: ' + options.field);
  console.log('原值: ' + oldValue);
  console.log('新值: ' + newValue);
  console.log('原因: ' + (options.reason || '未说明'));
  console.log('工程师: ' + engineer);
  console.log('累计修正: ' + record.correctionCount + ' 次');
}

module.exports = {
  reviewRecord: reviewRecord,
  correctRecord: correctRecord
};
