const auditDao = require('../dao/auditDao');
const prescriptionDao = require('../dao/prescriptionDao');
const fulfillmentDao = require('../dao/fulfillmentDao');
const inventoryDao = require('../dao/inventoryDao');

const getAuditReportData = (options = {}) => {
  const { startDate, endDate, operationType, operator } = options;

  const logs = auditDao.getAuditLogs({
    startDate,
    endDate,
    operationType,
    operator,
    limit: 1000
  });

  const stats = auditDao.getAuditStats();

  const prescriptions = prescriptionDao.getAllPrescriptions();
  const fulfillments = fulfillmentDao.getAllFulfillments();
  const payments = fulfillmentDao.getAllPaymentRecords();
  const inventory = inventoryDao.getAllInventory();

  const fulfillmentStatusCounts = fulfillments.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  const prescriptionStatusCounts = prescriptions.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const totalPaymentAmount = payments
    .filter(p => p.payment_status === 'SUCCESS')
    .reduce((sum, p) => sum + p.total_amount, 0);

  const totalRefundAmount = payments
    .filter(p => p.payment_status === 'REFUNDED')
    .reduce((sum, p) => sum + p.total_amount, 0);

  return {
    reportGeneratedAt: new Date().toISOString(),
    reportPeriod: {
      startDate: startDate || '未指定',
      endDate: endDate || '未指定'
    },
    summary: {
      totalAuditLogs: logs.length,
      totalPrescriptions: prescriptions.length,
      totalFulfillments: fulfillments.length,
      totalPayments: payments.length,
      totalPaymentAmount: parseFloat(totalPaymentAmount.toFixed(2)),
      totalRefundAmount: parseFloat(totalRefundAmount.toFixed(2)),
      prescriptionStatusCounts,
      fulfillmentStatusCounts,
      operationTypeStats: stats
    },
    auditLogs: logs,
    inventorySnapshot: inventory.map(item => ({
      drugCode: item.drug_code,
      drugName: item.drug_name,
      quantity: item.quantity,
      price: item.price
    }))
  };
};

const generateJsonReport = (options = {}) => {
  const data = getAuditReportData(options);
  return JSON.stringify(data, null, 2);
};

const generateMarkdownReport = (options = {}) => {
  const data = getAuditReportData(options);
  const { summary, auditLogs, inventorySnapshot } = data;

  let md = `# 处方取药核销台审计报告\n\n`;
  md += `> 报告生成时间: ${data.reportGeneratedAt}\n`;
  md += `> 报告周期: ${data.reportPeriod.startDate} ~ ${data.reportPeriod.endDate}\n\n`;

  md += `## 一、数据概览\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 审计日志总数 | ${summary.totalAuditLogs} |\n`;
  md += `| 处方总数 | ${summary.totalPrescriptions} |\n`;
  md += `| 核销单总数 | ${summary.totalFulfillments} |\n`;
  md += `| 支付记录总数 | ${summary.totalPayments} |\n`;
  md += `| 成功支付总金额 | ¥${summary.totalPaymentAmount.toFixed(2)} |\n`;
  md += `| 退款总金额 | ¥${summary.totalRefundAmount.toFixed(2)} |\n\n`;

  md += `## 二、处方状态统计\n\n`;
  md += `| 状态 | 数量 |\n`;
  md += `|------|------|\n`;
  Object.entries(summary.prescriptionStatusCounts).forEach(([status, count]) => {
    md += `| ${status} | ${count} |\n`;
  });
  md += `\n`;

  md += `## 三、核销单状态统计\n\n`;
  md += `| 状态 | 数量 |\n`;
  md += `|------|------|\n`;
  Object.entries(summary.fulfillmentStatusCounts).forEach(([status, count]) => {
    md += `| ${status} | ${count} |\n`;
  });
  md += `\n`;

  md += `## 四、操作类型统计\n\n`;
  md += `| 操作类型 | 总数 | 成功 | 失败 |\n`;
  md += `|----------|------|------|------|\n`;
  summary.operationTypeStats.forEach(stat => {
    md += `| ${stat.operation_type} | ${stat.total_count} | ${stat.success_count} | ${stat.failure_count} |\n`;
  });
  md += `\n`;

  md += `## 五、库存快照\n\n`;
  md += `| 药品编码 | 药品名称 | 当前库存 | 单价 |\n`;
  md += `|----------|----------|----------|------|\n`;
  inventorySnapshot.forEach(item => {
    md += `| ${item.drugCode} | ${item.drugName} | ${item.quantity} | ¥${item.price.toFixed(2)} |\n`;
  });
  md += `\n`;

  md += `## 六、审计日志详情\n\n`;
  if (auditLogs.length === 0) {
    md += `暂无审计日志记录\n`;
  } else {
    md += `| 时间 | 操作类型 | 操作描述 | 操作者 | 状态 |\n`;
    md += `|------|----------|----------|--------|------|\n`;
    auditLogs.forEach(log => {
      const status = log.success ? '成功' : '失败';
      md += `| ${log.created_at} | ${log.operation_type} | ${log.operation_desc} | ${log.operator} | ${status} |\n`;
    });
  }

  md += `\n---\n`;
  md += `*本报告由处方取药幂等核销台系统自动生成*\n`;

  return md;
};

module.exports = {
  getAuditReportData,
  generateJsonReport,
  generateMarkdownReport
};
