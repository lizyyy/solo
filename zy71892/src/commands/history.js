const { loadRecords, loadHistory, findRecord } = require('../utils/storage');

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showHistory(dataDir, recordId) {
  const history = loadHistory(dataDir);
  const records = loadRecords(dataDir);

  if (recordId) {
    const recordHistory = history[recordId];
    if (!recordHistory || recordHistory.length === 0) {
      console.log('记录 ' + recordId + ' 暂无历史记录');
      return;
    }

    console.log('=== 记录 ' + recordId + ' 历史记录 ===');
    recordHistory.forEach(function(entry, idx) {
      console.log('');
      console.log('[' + (idx + 1) + '] ' + formatTimestamp(entry.timestamp));
      console.log('  操作: ' + entry.action);
      console.log('  操作人: ' + entry.operator);
      if (entry.details) {
        console.log('  详情:');
        Object.keys(entry.details).forEach(function(k) {
          var v = entry.details[k];
          if (k === 'initialData') return;
          var valueStr = (typeof v === 'object') ? JSON.stringify(v) : v;
          console.log('    ' + k + ': ' + valueStr);
        });
      }
    });
  } else {
    console.log('=== 全部历史记录 ===');
    console.log('');
    const allRecordIds = Object.keys(history);
    if (allRecordIds.length === 0) {
      console.log('暂无历史记录');
      return;
    }

    allRecordIds.forEach(function(rid) {
      const record = findRecord(records, rid);
      const entries = history[rid];
      var trainNo = record ? record.trainNo : '未知';
      var date = record ? record.date : '未知';
      console.log('');
      console.log('记录: ' + rid + ' (' + trainNo + ' - ' + date + ')');
      console.log('  操作次数: ' + entries.length + ' 次');
      console.log('  最后操作: ' + formatTimestamp(entries[0] && entries[0].timestamp));
      console.log('  最后操作人: ' + (entries[0] && entries[0].operator));
    });
  }
}

function diffRecord(dataDir, recordId) {
  const history = loadHistory(dataDir);
  const recordHistory = history[recordId];

  if (!recordHistory || recordHistory.length === 0) {
    console.log('记录 ' + recordId + ' 暂无历史记录');
    return;
  }

  console.log('=== 记录 ' + recordId + ' 差异对比 ===');
  console.log('');

  const correctEntries = recordHistory.filter(function(e) {
    return e.action === 'correct';
  });

  if (correctEntries.length === 0) {
    console.log('该记录无修正历史');
    return;
  }

  correctEntries.forEach(function(entry, idx) {
    console.log('修正 #' + (idx + 1) + ' - ' + formatTimestamp(entry.timestamp));
    console.log('  操作人: ' + entry.operator);
    console.log('  字段: ' + entry.details.field);
    console.log('  变化: ' + entry.details.oldValue + ' -> ' + entry.details.newValue);
    console.log('  原因: ' + entry.details.reason);
    console.log('');
  });
}

module.exports = {
  showHistory: showHistory,
  diffRecord: diffRecord
};
