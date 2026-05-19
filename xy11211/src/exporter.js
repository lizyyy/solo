const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const { format } = require('date-fns');

function exportToCSV(records, outputPath) {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'id', title: '记录ID' },
      { id: 'pumpRoom', title: '泵房名称' },
      { id: 'anomalyType', title: '异常类型' },
      { id: 'description', title: '问题描述' },
      { id: 'handler', title: '负责人' },
      { id: 'status', title: '状态' },
      { id: 'escalationLevel', title: '升级级别' },
      { id: 'createdAt', title: '创建时间' },
      { id: 'updatedAt', title: '更新时间' },
      { id: 'processingResult', title: '处理结果' }
    ]
  });

  const csvRecords = records.map(r => ({
    id: r.id,
    pumpRoom: r.pumpRoom,
    anomalyType: r.anomalyType || '',
    description: r.description || '',
    handler: r.handler || '',
    status: r.status,
    escalationLevel: r.escalationLevel || 0,
    createdAt: format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm:ss'),
    updatedAt: format(new Date(r.updatedAt), 'yyyy-MM-dd HH:mm:ss'),
    processingResult: r.processingResult || ''
  }));

  return csvWriter.writeRecords(csvRecords).then(() => outputPath);
}

function exportToJSON(records, outputPath) {
  const content = JSON.stringify(records, null, 2);
  fs.writeFileSync(outputPath, content, 'utf8');
  return outputPath;
}

function exportSummary(summary, outputPath) {
  const lines = [
    '=== 泵房巡检记录汇总报告 ===',
    '',
    `生成时间: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
    '',
    '--- 统计数据 ---',
    `总记录数: ${summary.stats.total}`,
    `进行中: ${summary.stats.open}`,
    `已关闭: ${summary.stats.closed}`,
    `已重开: ${summary.stats.reopen}`,
    `已升级: ${summary.stats.escalated}`,
    `需关注(超时24h): ${summary.stats.needsAttention}`,
    '',
    '--- 按泵房统计 ---',
    ...Object.entries(summary.byPumpRoom).map(([k, v]) => `${k}: ${v}条`),
    '',
    '--- 按负责人统计 ---',
    ...Object.entries(summary.byHandler).map(([k, v]) => `${k}: ${v}条`),
    '',
    '--- 按异常类型统计 ---',
    ...Object.entries(summary.byAnomalyType).map(([k, v]) => `${k}: ${v}条`)
  ];

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  return outputPath;
}

module.exports = {
  exportToCSV,
  exportToJSON,
  exportSummary
};
