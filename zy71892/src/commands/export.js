const fs = require('fs');
const path = require('path');
const { loadRecords } = require('../utils/storage');

function exportData(dataDir, options) {
  const records = loadRecords(dataDir);
  var filteredRecords = records;

  if (options.type === 'report') {
    filteredRecords = records.filter(function(r) { return r.type === 'inspection'; });
  } else if (options.type === 'detail') {
    filteredRecords = records.filter(function(r) { return r.type === 'shift'; });
  }

  var outputPath = options.output || ('brake-temperature-export-' + Date.now() + '.' + options.format);
  var resolvedPath = path.resolve(outputPath);

  if (options.format === 'json') {
    fs.writeFileSync(resolvedPath, JSON.stringify(filteredRecords, null, 2), 'utf8');
  } else if (options.format === 'md') {
    var mdContent = generateMarkdownReport(filteredRecords, options.type);
    fs.writeFileSync(resolvedPath, mdContent, 'utf8');
  }

  console.log('导出成功: ' + resolvedPath);
  console.log('共 ' + filteredRecords.length + ' 条记录');
}

function generateMarkdownReport(records, type) {
  var lines = [];
  lines.push('# 轨道制动温升记录');
  lines.push('');
  lines.push('导出时间: ' + new Date().toLocaleString('zh-CN'));
  lines.push('记录数量: ' + records.length);
  lines.push('');

  if (records.length === 0) {
    lines.push('暂无记录');
    return lines.join('\n');
  }

  lines.push('## 记录明细');
  lines.push('');
  lines.push('| ID | 日期 | 车组 | 车厢 | 制动位置 | 温度(°C) | 报警级别 | 状态 | 备注 |');
  lines.push('|----|------|------|------|----------|----------|----------|------|------|');

  records.forEach(function(r) {
    var id = r.id || '-';
    var date = r.date || '-';
    var trainNo = r.trainNo || '-';
    var carriageNo = r.carriageNo || '-';
    var brakePosition = r.brakePosition || '-';
    var temperature = r.temperature !== undefined ? r.temperature : '-';
    var alarmLevel = r.alarmLevel || '-';
    var status = r.status || '-';
    var notes = (r.notes || '').replace(/\|/g, '/');
    lines.push('| ' + id + ' | ' + date + ' | ' + trainNo + ' | ' + carriageNo + ' | ' + brakePosition + ' | ' + temperature + ' | ' + alarmLevel + ' | ' + status + ' | ' + notes + ' |');
  });

  var correctedRecords = records.filter(function(r) { return r.status === 'corrected'; });
  if (correctedRecords.length > 0) {
    lines.push('');
    lines.push('## 修正记录');
    lines.push('');
    correctedRecords.forEach(function(r) {
      lines.push('### ' + r.id);
      lines.push('');
      lines.push('- 车组: ' + r.trainNo + ' 车厢: ' + r.carriageNo);
      lines.push('- 累计修正: ' + (r.correctionCount || 1) + ' 次');
      if (r.corrections && r.corrections.length > 0) {
        lines.push('- 修正详情:');
        r.corrections.forEach(function(c, idx) {
          lines.push('  ' + (idx + 1) + '. ' + c.field + ': ' + c.oldValue + ' -> ' + c.newValue + ' (' + c.timestamp + ')');
        });
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

function exportReport(dataDir, options) {
  const records = loadRecords(dataDir);
  var outputPath = path.resolve(options.output);

  var shiftRecords = records.filter(function(r) { return r.type === 'shift'; });
  var inspectionRecords = records.filter(function(r) { return r.type === 'inspection'; });

  var lines = [];
  lines.push('# 轨道制动温升巡检报告');
  lines.push('');
  lines.push('## 报告信息');
  lines.push('');
  lines.push('- 生成时间: ' + new Date().toLocaleString('zh-CN'));
  lines.push('- 班组记录数: ' + shiftRecords.length);
  lines.push('- 巡检记录数: ' + inspectionRecords.length);
  lines.push('- 总记录数: ' + records.length);
  lines.push('');

  var pendingRecords = records.filter(function(r) { return r.status === 'pending'; });
  var reviewedRecords = records.filter(function(r) { return r.status === 'reviewed'; });
  var correctedRecords = records.filter(function(r) { return r.status === 'corrected'; });

  lines.push('## 状态统计');
  lines.push('');
  lines.push('- 待复核: ' + pendingRecords.length);
  lines.push('- 已复核: ' + reviewedRecords.length);
  lines.push('- 已修正: ' + correctedRecords.length);
  lines.push('');

  var alarmRecords = records.filter(function(r) { return r.alarmLevel === 'warning' || r.alarmLevel === 'critical'; });
  if (alarmRecords.length > 0) {
    lines.push('## 报警记录汇总');
    lines.push('');
    lines.push('| 日期 | 车组 | 车厢 | 位置 | 温度 | 级别 | 来源 | 状态 |');
    lines.push('|------|------|------|------|------|------|------|------|');
    alarmRecords.forEach(function(r) {
      lines.push('| ' + r.date + ' | ' + r.trainNo + ' | ' + r.carriageNo + ' | ' + (r.brakePosition || '-') + ' | ' + r.temperature + ' | ' + r.alarmLevel + ' | ' + (r.alarmSource || '-') + ' | ' + r.status + ' |');
    });
    lines.push('');
  }

  if (correctedRecords.length > 0) {
    lines.push('## 修正说明');
    lines.push('');
    lines.push('以下记录经过设备工程师手动修正，原始值已同步至明细:');
    lines.push('');
    correctedRecords.forEach(function(r) {
      lines.push('- **' + r.id + '** (' + r.trainNo + '-' + r.carriageNo + '): 共 ' + (r.correctionCount || 1) + ' 次修正');
    });
    lines.push('');
  }

  lines.push('## 数据一致性说明');
  lines.push('');
  lines.push('本报告与明细数据来源一致，修正记录已完整保留。');
  lines.push('');

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log('巡检报告已生成: ' + outputPath);
}

module.exports = {
  exportData: exportData,
  exportReport: exportReport,
  generateMarkdownReport: generateMarkdownReport
};
