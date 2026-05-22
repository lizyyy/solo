const path = require('path');
const fs = require('fs');
const { getBatchById } = require('./batchService');
const { getTasksByBatchId, getCalculationResults, markTaskExported } = require('./taskService');
const { getAuditLogsByBatchId } = require('./auditService');

const reportsDir = path.join(__dirname, '../../reports');

function ensureReportsDir() {
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
}

async function generateCSVReport(batchId, operator) {
  ensureReportsDir();
  
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  const tasks = await getTasksByBatchId(batchId);
  if (tasks.length === 0) {
    throw new Error('该批次没有处理任务');
  }
  
  const latestTask = tasks[0];
  const results = await getCalculationResults(latestTask.id);
  
  const headers = [
    '排片ID',
    '影院ID',
    '影院名称',
    '影片ID',
    '影片名称',
    '分类',
    '原因',
    '补贴金额(元)',
    '原始票房(元)',
    '退票扣款(元)',
    '退票率(%)',
    '保底金额(元)',
    '保底生效',
    '最终票房(元)',
    '是否跨日',
    '跨日拆分',
    '补贴费率(%)'
  ];
  
  const rows = results.map(r => {
    const d = r.details || {};
    const crossDaySplit = d.crossDaySplit 
      ? d.crossDaySplit.map(s => `${s.date}:${s.amount}`).join('|') 
      : '';
    
    return [
      r.screeningId,
      r.cinemaId,
      r.cinemaName,
      r.filmId,
      r.filmName,
      getCategoryName(r.category),
      r.reason || '',
      r.subsidyAmount,
      d.originalBoxOffice || 0,
      d.refundDeduction || 0,
      ((d.refundRatio || 0) * 100).toFixed(2),
      d.guaranteeAmount || '',
      d.guaranteeApplied ? '是' : '否',
      d.finalBoxOffice || 0,
      d.isCrossDay ? '是' : '否',
      crossDaySplit,
      ((d.subsidyRate || 0) * 100).toFixed(1)
    ].map(v => `"${v}"`).join(',');
  });
  
  const summary = generateSummary(batch, results);
  
  const csvContent = [
    `"批次名称","${batch.batchName}"`,
    `"批次ID","${batch.id}"`,
    `"操作员","${batch.operator}"`,
    `"统计周期","${batch.startDate} 至 ${batch.endDate}"`,
    `"生成时间","${new Date().toISOString()}"`,
    `"",`,
    `"汇总统计"`,
    ...summary,
    `"",`,
    `"明细数据"`,
    headers.join(','),
    ...rows
  ].join('\n');
  
  const fileName = `subsidy-report-${batchId}-${Date.now()}.csv`;
  const filePath = path.join(reportsDir, fileName);
  
  fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');
  
  await markTaskExported(latestTask.id, operator);
  
  return {
    fileName,
    filePath,
    batch,
    summary: parseSummary(summary)
  };
}

function generateSummary(batch, results) {
  const total = results.length;
  const normalCount = results.filter(r => r.category === 'normal').length;
  const pendingCount = results.filter(r => r.category === 'pending').length;
  const blockedCount = results.filter(r => r.category === 'blocked').length;
  const totalSubsidy = results.reduce((sum, r) => sum + r.subsidyAmount, 0);
  const normalSubsidy = results.filter(r => r.category === 'normal').reduce((sum, r) => sum + r.subsidyAmount, 0);
  
  return [
    `"总排片数","${total}"`,
    `"正常核算","${normalCount}"`,
    `"待补充","${pendingCount}"`,
    `"已拦截","${blockedCount}"`,
    `"应发补贴总额","${totalSubsidy.toFixed(2)}元"`,
    `"正常核算补贴","${normalSubsidy.toFixed(2)}元"`
  ];
}

function parseSummary(summaryLines) {
  const summary = {};
  summaryLines.forEach(line => {
    const match = line.match(/"([^"]+)","([^"]+)"/);
    if (match) {
      summary[match[1]] = match[2];
    }
  });
  return summary;
}

function getCategoryName(category) {
  const names = {
    normal: '正常',
    pending: '待补充',
    blocked: '已拦截'
  };
  return names[category] || category;
}

async function generateReportData(batchId) {
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  const tasks = await getTasksByBatchId(batchId);
  if (tasks.length === 0) {
    throw new Error('该批次没有处理任务');
  }
  
  const latestTask = tasks[0];
  const results = await getCalculationResults(latestTask.id);
  const auditLogs = await getAuditLogsByBatchId(batchId);
  
  return {
    batch,
    task: latestTask,
    results,
    auditLogs
  };
}

function getReportFilePath(fileName) {
  return path.join(reportsDir, fileName);
}

module.exports = {
  generateCSVReport,
  generateReportData,
  getReportFilePath
};
