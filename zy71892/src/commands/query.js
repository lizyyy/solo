const { loadRecords } = require('../utils/storage');

function queryRecords(dataDir, options) {
  var records = loadRecords(dataDir);

  if (options.status) {
    records = records.filter(function(r) { return r.status === options.status; });
  }

  if (options.date) {
    records = records.filter(function(r) { return r.date === options.date; });
  }

  if (records.length === 0) {
    console.log('未找到符合条件的记录');
    return;
  }

  console.log('找到 ' + records.length + ' 条记录:');
  console.log('');

  records.forEach(function(r) {
    console.log('[' + r.id + ']');
    console.log('  日期: ' + r.date);
    console.log('  车组: ' + r.trainNo + ' 车厢: ' + r.carriageNo);
    console.log('  温度: ' + r.temperature + '°C 级别: ' + (r.alarmLevel || '-'));
    console.log('  状态: ' + r.status);
    if (r.correctionCount) {
      console.log('  修正次数: ' + r.correctionCount);
    }
    console.log('');
  });
}

function showStatus(dataDir) {
  const records = loadRecords(dataDir);

  console.log('=== 轨道制动温升状态 ===');
  console.log('');

  var total = records.length;
  var pending = 0, reviewed = 0, corrected = 0;
  for (var i = 0; i < records.length; i++) {
    if (records[i].status === 'pending') pending++;
    else if (records[i].status === 'reviewed') reviewed++;
    else if (records[i].status === 'corrected') corrected++;
  }

  console.log('总记录数: ' + total);
  console.log('待复核: ' + pending);
  console.log('已复核: ' + reviewed);
  console.log('已修正: ' + corrected);
  console.log('');

  var normal = 0, warning = 0, critical = 0;
  for (var j = 0; j < records.length; j++) {
    if (records[j].alarmLevel === 'normal') normal++;
    else if (records[j].alarmLevel === 'warning') warning++;
    else if (records[j].alarmLevel === 'critical') critical++;
  }

  console.log('温度分布:');
  console.log('  正常: ' + normal);
  console.log('  预警: ' + warning);
  console.log('  报警: ' + critical);
  console.log('');

  if (records.length > 0) {
    var dateMap = {};
    var trainMap = {};
    for (var k = 0; k < records.length; k++) {
      dateMap[records[k].date] = true;
      trainMap[records[k].trainNo] = true;
    }
    var dates = Object.keys(dateMap).sort();
    var trains = Object.keys(trainMap);
    console.log('记录日期: ' + dates.join(', '));
    console.log('涉及车组: ' + trains.join(', '));
  }

  var unconfirmed = records.filter(function(r) {
    return (r.alarmLevel === 'warning' || r.alarmLevel === 'critical') && r.status === 'pending';
  });
  if (unconfirmed.length > 0) {
    console.log('');
    console.log('⚠️ 有 ' + unconfirmed.length + ' 条报警待处理:');
    var displayCount = Math.min(unconfirmed.length, 5);
    for (var m = 0; m < displayCount; m++) {
      var r = unconfirmed[m];
      console.log('  ' + r.id + ': ' + r.trainNo + '-' + r.carriageNo + ' ' + r.temperature + '°C');
    }
    if (unconfirmed.length > 5) {
      console.log('  ... 还有 ' + (unconfirmed.length - 5) + ' 条更多');
    }
  }
}

module.exports = {
  queryRecords: queryRecords,
  showStatus: showStatus
};
