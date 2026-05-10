const fs = require('fs');
const path = require('path');
const { FILES, readJsonFile } = require('../models/store');

function listHistory(filters = {}) {
  const history = readJsonFile(FILES.history, []);
  let filtered = history;
  
  if (filters.entityType) {
    filtered = filtered.filter(h => h.entityType === filters.entityType);
  }
  
  if (filters.entityId) {
    filtered = filtered.filter(h => h.entityId === filters.entityId);
  }
  
  if (filters.operation) {
    filtered = filtered.filter(h => h.operation === filters.operation);
  }
  
  if (filters.since) {
    const since = new Date(filters.since);
    filtered = filtered.filter(h => new Date(h.timestamp) >= since);
  }
  
  return filtered;
}

function exportManagerReport(checkResult, outputPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = outputPath || path.join(process.cwd(), `清洗排期报告-${timestamp}.txt`);
  
  let report = `
╔════════════════════════════════════════════════════════════╗
║                商用厨房油烟管道清洗排期报告                  ║
╚════════════════════════════════════════════════════════════╝

生成时间: ${new Date().toLocaleString('zh-CN')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        总体概况
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

门店总数: ${checkResult.totalStores}
清洗正常: ${checkResult.summary.normal}
即将到期: ${checkResult.summary.warning}
清洗逾期: ${checkResult.summary.overdue}
消防检查逾期: ${checkResult.summary.inspectionOverdue}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                      异常门店列表
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  if (checkResult.anomalies.length === 0) {
    report += '\n✅ 所有门店均无异常\n';
  } else {
    for (const anomaly of checkResult.anomalies) {
      report += `\n【${anomaly.storeId}】${anomaly.storeName}\n`;
      report += `   地址: ${anomaly.location || '未填写'}\n`;
      report += `   负责人: ${anomaly.manager || '未填写'}\n`;
      report += `   电话: ${anomaly.phone || '未填写'}\n`;
      report += `   下次清洗: ${anomaly.nextCleanDate}\n`;
      report += '   异常项目:\n';
      
      for (const item of anomaly.anomalies) {
        const severityIcon = item.severity === 'critical' ? '🔴' : '🟡';
        report += `     ${severityIcon} ${item.message}\n`;
      }
    }
  }

  report += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    全门店清洗排期表
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${'门店ID'.padEnd(10)}${'门店名称'.padEnd(20)}${'上次清洗'.padEnd(12)}${'下次清洗'.padEnd(12)}${'剩余天数'.padEnd(10)}状态
${'─'.repeat(74)}
`;

  for (const schedule of checkResult.schedules) {
    let status = '✅ 正常';
    if (schedule.isOverdue) status = '🔴 逾期';
    else if (schedule.isWarning) status = '🟡 即将到期';
    
    report += `${schedule.storeId.padEnd(10)}${schedule.storeName.padEnd(20)}${(schedule.lastCleanDate || '-').padEnd(12)}${schedule.nextCleanDate.padEnd(12)}${String(schedule.daysRemaining).padEnd(10)}${status}\n`;
  }

  report += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        操作建议
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 立即联系所有🔴逾期门店的负责人，安排紧急清洗
2. 对🟡即将到期门店，提前1-2天确认清洗计划
3. 检查消防检查逾期门店，安排补检
4. 对消防检查不合格门店，跟进整改情况并缩短清洗周期

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  fs.writeFileSync(filePath, report, 'utf-8');
  return filePath;
}

function exportJson(checkResult, outputPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = outputPath || path.join(process.cwd(), `清洗排期数据-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(checkResult, null, 2), 'utf-8');
  return filePath;
}

module.exports = {
  listHistory,
  exportManagerReport,
  exportJson
};