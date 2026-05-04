const moment = require('moment');
const { Op } = require('sequelize');
const { 
  Batch, 
  Vehicle, 
  Store, 
  WeighingRecord, 
  Waybill, 
  Review,
  RiskRecord
} = require('../models');

const RISK_TYPE_NAMES = {
  'duplicate_weighing': '重复称重',
  'store_mismatch': '合同门店不匹配',
  'gps_not_at_store': '轨迹未到店',
  'time_overdue': '超时回收',
  'suspicious_dumping': '疑似偷倒',
  'weight_anomaly': '重量异常'
};

const SEVERITY_NAMES = {
  'low': '低',
  'medium': '中',
  'high': '高',
  'critical': '严重'
};

const STATUS_NAMES = {
  'pending': '待处理',
  'processing': '处理中',
  'reviewed': '已复核',
  'completed': '已完成',
  'flagged': '有异常'
};

const exportAuditMarkdown = async (date = null) => {
  const targetDate = date ? moment(date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
  
  const batches = await Batch.findAll({
    where: {
      date: targetDate
    },
    include: [
      { model: Vehicle, as: 'vehicle' },
      { model: Review, as: 'reviews' },
      { model: RiskRecord, as: 'riskRecords' }
    ],
    order: [['createdAt', 'ASC']]
  });

  let markdown = `# 餐厨废油回收稽核报告\n\n`;
  markdown += `**日期**: ${targetDate}\n\n`;
  markdown += `**生成时间**: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
  markdown += `---\n\n`;

  const totalBatches = batches.length;
  const flaggedBatches = batches.filter(b => b.hasRisks).length;
  const reviewedBatches = batches.filter(b => b.status === 'reviewed' || b.status === 'completed').length;
  
  let totalWeight = 0;
  let totalStores = 0;
  let totalWaybills = 0;
  
  batches.forEach(b => {
    totalWeight += b.totalWeight || 0;
    totalStores += b.storeCount || 0;
    totalWaybills += b.waybillCount || 0;
  });

  markdown += `## 一、概览\n\n`;
  markdown += `| 指标 | 数值 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总批次数 | ${totalBatches} |\n`;
  markdown += `| 有异常批次 | ${flaggedBatches} |\n`;
  markdown += `| 已复核批次 | ${reviewedBatches} |\n`;
  markdown += `| 总重量(千克) | ${totalWeight.toFixed(2)} |\n`;
  markdown += `| 回收门店数 | ${totalStores} |\n`;
  markdown += `| 联单总数 | ${totalWaybills} |\n\n`;

  markdown += `## 二、风险统计\n\n`;
  
  const allRisks = [];
  batches.forEach(b => {
    if (b.riskRecords) {
      allRisks.push(...b.riskRecords);
    }
  });

  const riskByType = {};
  const riskBySeverity = {};
  
  allRisks.forEach(risk => {
    riskByType[risk.riskType] = (riskByType[risk.riskType] || 0) + 1;
    riskBySeverity[risk.severity] = (riskBySeverity[risk.severity] || 0) + 1;
  });

  markdown += `### 2.1 按风险类型\n\n`;
  markdown += `| 风险类型 | 数量 |\n`;
  markdown += `|----------|------|\n`;
  for (const [type, count] of Object.entries(riskByType)) {
    markdown += `| ${RISK_TYPE_NAMES[type] || type} | ${count} |\n`;
  }
  if (Object.keys(riskByType).length === 0) {
    markdown += `| 无风险 | 0 |\n`;
  }
  markdown += `\n`;

  markdown += `### 2.2 按严重程度\n\n`;
  markdown += `| 严重程度 | 数量 |\n`;
  markdown += `|----------|------|\n`;
  for (const [severity, count] of Object.entries(riskBySeverity)) {
    markdown += `| ${SEVERITY_NAMES[severity] || severity} | ${count} |\n`;
  }
  if (Object.keys(riskBySeverity).length === 0) {
    markdown += `| 无风险 | 0 |\n`;
  }
  markdown += `\n`;

  markdown += `## 三、批次详情\n\n`;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    markdown += `### 3.${i + 1} 批次 ${batch.batchNumber}\n\n`;
    
    markdown += `- **状态**: ${STATUS_NAMES[batch.status] || batch.status}\n`;
    markdown += `- **风险等级**: ${SEVERITY_NAMES[batch.riskLevel] || batch.riskLevel}\n`;
    markdown += `- **车牌号**: ${batch.vehicle?.plateNumber || '未知'}\n`;
    markdown += `- **司机**: ${batch.vehicle?.driverName || '未知'}\n`;
    markdown += `- **重量**: ${batch.totalWeight || 0} 千克\n`;
    markdown += `- **门店数**: ${batch.storeCount || 0}\n`;
    markdown += `- **联单数**: ${batch.waybillCount || 0}\n\n`;

    if (batch.riskRecords && batch.riskRecords.length > 0) {
      markdown += `**风险记录**:\n\n`;
      batch.riskRecords.forEach((risk, idx) => {
        markdown += `1. **${RISK_TYPE_NAMES[risk.riskType] || risk.riskType}** (${SEVERITY_NAMES[risk.severity] || risk.severity})\n`;
        markdown += `   - 描述: ${risk.description}\n`;
        markdown += `   - 状态: ${risk.isResolved ? '已解决' : '待处理'}\n`;
        if (risk.isResolved && risk.resolutionNote) {
          markdown += `   - 解决说明: ${risk.resolutionNote}\n`;
        }
        markdown += `\n`;
      });
    }

    if (batch.reviews && batch.reviews.length > 0) {
      markdown += `**复核记录**:\n\n`;
      batch.reviews.forEach(review => {
        markdown += `- **复核人**: ${review.reviewerName}\n`;
        markdown += `  **时间**: ${moment(review.reviewTime).format('YYYY-MM-DD HH:mm:ss')}\n`;
        markdown += `  **决定**: ${review.decision}\n`;
        if (review.comment) {
          markdown += `  **意见**: ${review.comment}\n`;
        }
        markdown += `\n`;
      });
    }

    markdown += `---\n\n`;
  }

  return markdown;
};

const exportAuditJSON = async (date = null) => {
  const targetDate = date ? moment(date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
  
  const batches = await Batch.findAll({
    where: {
      date: targetDate
    },
    include: [
      { model: Vehicle, as: 'vehicle' },
      { model: Review, as: 'reviews' },
      { model: RiskRecord, as: 'riskRecords' }
    ],
    order: [['createdAt', 'ASC']]
  });

  const batchIds = batches.map(b => b.id);
  
  const [weighingRecords, waybills] = await Promise.all([
    WeighingRecord.findAll({
      where: { batchId: { [Op.in]: batchIds } },
      include: [{ model: Store, as: 'store' }]
    }),
    Waybill.findAll({
      where: { batchId: { [Op.in]: batchIds } },
      include: [{ model: Store, as: 'store' }]
    })
  ]);

  const totalBatches = batches.length;
  const flaggedBatches = batches.filter(b => b.hasRisks).length;
  const reviewedBatches = batches.filter(b => b.status === 'reviewed' || b.status === 'completed').length;
  
  let totalWeight = 0;
  let totalStores = 0;
  let totalWaybills = 0;
  
  batches.forEach(b => {
    totalWeight += b.totalWeight || 0;
    totalStores += b.storeCount || 0;
    totalWaybills += b.waybillCount || 0;
  });

  const allRisks = [];
  batches.forEach(b => {
    if (b.riskRecords) {
      allRisks.push(...b.riskRecords.map(r => ({
        ...r.toJSON(),
        riskTypeName: RISK_TYPE_NAMES[r.riskType] || r.riskType,
        severityName: SEVERITY_NAMES[r.severity] || r.severity
      })));
    }
  });

  const auditJSON = {
    audit: {
      date: targetDate,
      generatedAt: moment().toISOString(),
      summary: {
        totalBatches,
        flaggedBatches,
        reviewedBatches,
        totalWeight: totalWeight,
        totalStores,
        totalWaybills,
        totalRisks: allRisks.length
      },
      riskStatistics: {
        byType: {},
        bySeverity: {}
      }
    },
    batches: batches.map(batch => {
      const batchRisks = (batch.riskRecords || []).map(r => ({
        ...r.toJSON(),
        riskTypeName: RISK_TYPE_NAMES[r.riskType] || r.riskType,
        severityName: SEVERITY_NAMES[r.severity] || r.severity
      }));
      
      return {
        ...batch.toJSON(),
        statusName: STATUS_NAMES[batch.status] || batch.status,
        riskLevelName: SEVERITY_NAMES[batch.riskLevel] || batch.riskLevel,
        weighingRecords: weighingRecords.filter(w => w.batchId === batch.id),
        waybills: waybills.filter(w => w.batchId === batch.id),
        riskRecords: batchRisks
      };
    }),
    risks: allRisks
  };

  allRisks.forEach(risk => {
    auditJSON.audit.riskStatistics.byType[risk.riskTypeName] = 
      (auditJSON.audit.riskStatistics.byType[risk.riskTypeName] || 0) + 1;
    auditJSON.audit.riskStatistics.bySeverity[risk.severityName] = 
      (auditJSON.audit.riskStatistics.bySeverity[risk.severityName] || 0) + 1;
  });

  return auditJSON;
};

module.exports = {
  exportAuditMarkdown,
  exportAuditJSON,
  RISK_TYPE_NAMES,
  SEVERITY_NAMES,
  STATUS_NAMES
};
