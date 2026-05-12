const fs = require('fs');
const chalk = require('chalk');
const dataStore = require('../utils/dataStore');
const assessor = require('../core/assessor');

const formatText = (report) => {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push(`冷库温控告警归档报告`);
  lines.push(`生成时间: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  
  if (report.type === 'summary') {
    lines.push('【汇总统计】');
    lines.push('');
    lines.push(`总告警数: ${report.totalAlerts}`);
    lines.push(`已评估: ${report.assessed}`);
    lines.push(`未评估: ${report.notAssessed}`);
    lines.push('');
    
    lines.push('按状态分布:');
    Object.entries(report.byStatus || {}).forEach(([status, count]) => {
      const bar = '█'.repeat(Math.min(count * 2, 20));
      lines.push(`  ${status.padEnd(10)} ${bar} (${count})`);
    });
    lines.push('');
    
    lines.push('按严重程度分布:');
    Object.entries(report.bySeverity || {}).forEach(([severity, count]) => {
      const bar = '█'.repeat(Math.min(count * 2, 20));
      lines.push(`  ${severity.padEnd(10)} ${bar} (${count})`);
    });
    lines.push('');
    
    if (report.continuousAlerts && report.continuousAlerts.length > 0) {
      lines.push('【24小时内待处理告警】');
      lines.push('');
      report.continuousAlerts.forEach(a => {
        lines.push(`  ${a.alertId} [${a.status}] - ${a.recommendation || '无建议'}`);
        if (a.affectedBatches > 0) {
          lines.push(`    受影响批次: ${a.affectedBatches} 个`);
        }
      });
      lines.push('');
    }
    
    if (report.highRiskBatches && report.highRiskBatches.length > 0) {
      lines.push(chalk.red('【高风险批次（建议复检/报损）:'));
      lines.push('');
      report.highRiskBatches.forEach(b => {
        lines.push(`  ${b.batchId} - ${b.productName} (${b.quantity}${b.unit || ''})`);
        lines.push(`    关联告警: ${b.alertId}`);
        lines.push(`    建议: ${b.recommendation}`);
      });
    }
  } else if (report.type === 'batch') {
    lines.push('【批次风险报告】');
    lines.push('');
    
    if (report.batches && report.batches.length > 0) {
      report.batches.forEach(b => {
        lines.push(`批次: ${b.id}`);
        lines.push(`  商品: ${b.productName}`);
        lines.push(`  数量: ${b.quantity}${b.unit || ''}`);
        lines.push(`  仓库: ${b.warehouseId}`);
        lines.push(`  入库: ${b.inTime}`);
        if (b.outTime) lines.push(`  出库: ${b.outTime}`);
        lines.push(`  要求温度: ${b.requiredTemperature}°C`);
        if (b.alerts && b.alerts.length > 0) {
          lines.push(`  关联告警 (${b.alerts.length} 个):`);
          b.alerts.forEach(a => {
            lines.push(`    ${a.alertId} [${a.severity}] ${a.status}`);
          });
        } else {
          lines.push('  无关联告警');
        }
        lines.push('');
      });
    }
  } else if (report.type === 'risk') {
    lines.push('【风险明细报告】');
    lines.push('');
    
    if (report.alerts && report.alerts.length > 0) {
      report.alerts.forEach(a => {
        const statusColor = a.status === 'CRITICAL' || a.status === 'HIGH' ? '[' + a.status + ']' :
                          a.status === 'PENDING' || a.status === 'MEDIUM' ? '[' + a.status + ']' :
                          '[' + a.status + ']';
        lines.push(`${a.alertId} ${statusColor}`);
        lines.push(`  触发时间: ${a.triggeredAt}`);
        lines.push(`  严重程度: ${a.severity}`);
        lines.push(`  建议: ${a.recommendation || '无'}`);
        if (a.affectedBatches > 0) {
          lines.push(`  受影响批次: ${a.affectedBatches}`);
        }
        if (a.mitigations && a.mitigations.length > 0) {
          lines.push(`  缓解因素: ${a.mitigations.join('; ')}`);
        }
        if (a.manuallyCorrected) {
          lines.push(`  人工修正: 是 (${a.correctedBy})`);
        }
        lines.push('');
      });
    } else {
      lines.push('暂无风险告警');
    }
  }
  
  return lines.join('\n');
};

const generateSummaryReport = () => {
  const alerts = dataStore.list('alerts');
  const assessments = dataStore.list('assessments');
  
  const byStatus = {};
  const bySeverity = {};
  const highRiskBatches = [];
  
  assessments.forEach(a => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    
    if (a.status === 'CRITICAL' || a.severity === 'HIGH') {
      a.affectedBatches?.forEach(b => {
        highRiskBatches.push({
          batchId: b.id,
          productName: b.productName,
          quantity: b.quantity,
          unit: b.unit,
          alertId: a.alertId,
          recommendation: a.recommendation
        });
      });
    }
  });
  
  const continuousAlerts = assessor.getContinuousAlerts(null, 24).map(a => ({
    alertId: a.alertId,
    status: a.status,
    severity: a.severity,
    recommendation: a.recommendation,
    affectedBatches: (a.affectedBatches || []).length,
    checkedAt: a.checkedAt
  }));
  
  return {
    type: 'summary',
    generatedAt: new Date().toISOString(),
    totalAlerts: alerts.length,
    assessed: assessments.length,
    notAssessed: alerts.length - assessments.filter(a => a.status !== 'ERROR').length,
    byStatus,
    bySeverity,
    continuousAlerts,
    highRiskBatches
  };
};

const generateBatchReport = () => {
  const batches = dataStore.list('batch');
  const assessments = dataStore.list('assessments');
  
  const enrichedBatches = batches.map(b => {
    const relatedAlerts = assessments.filter(a => 
      a.affectedBatches?.some(ab => ab.id === b.id)
    ).map(a => ({
      alertId: a.alertId,
      status: a.status,
      severity: a.severity,
      recommendation: a.recommendation
    }));
    
    return {
      ...b,
      alerts: relatedAlerts,
      riskLevel: relatedAlerts.some(a => a.status === 'CRITICAL' || a.severity === 'HIGH') ? 'HIGH' :
                 relatedAlerts.some(a => a.status === 'PENDING' || a.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW'
    };
  });
  
  return {
    type: 'batch',
    generatedAt: new Date().toISOString(),
    batches: enrichedBatches
  };
};

const generateRiskReport = () => {
  const assessments = dataStore.list('assessments');
  const alerts = dataStore.list('alerts');
  
  const riskAlerts = assessments
    .filter(a => a.status === 'CRITICAL' || a.status === 'PENDING' || a.severity === 'HIGH' || a.severity === 'MEDIUM')
    .map(a => {
      const alert = alerts.find(al => al.id === a.alertId);
      return {
        alertId: a.alertId,
        status: a.status,
        severity: a.severity,
        triggeredAt: alert?.triggeredAt,
        recommendation: a.recommendation,
        affectedBatches: (a.affectedBatches || []).length,
        mitigations: a.mitigations || [],
        manuallyCorrected: a.manuallyCorrected,
        correctedBy: a.correctedBy
      };
    })
    .sort((a, b) => {
      const priority = { CRITICAL: 0, HIGH: 1, PENDING: 2, MEDIUM: 3 };
      return (priority[a.status] || 99) - (priority[b.status] || 99);
    });
  
  return {
    type: 'risk',
    generatedAt: new Date().toISOString(),
    alerts: riskAlerts
  };
};

module.exports = async (options) => {
  const type = options.type || 'summary';
  
  let report;
  switch (type) {
    case 'summary':
      report = generateSummaryReport();
      break;
    case 'batch':
      report = generateBatchReport();
      break;
    case 'risk':
      report = generateRiskReport();
      break;
    default:
      throw new Error(`不支持的报告类型: ${type}。支持: summary, batch, risk`);
  }
  
  let content;
  if (options.format === 'json') {
    content = JSON.stringify(report, null, 2);
  } else {
    content = formatText(report);
  }
  
  if (options.output) {
    fs.writeFileSync(options.output, content, 'utf-8');
    console.log(chalk.green(`✓ 报告已保存到: ${options.output}`));
  } else {
    console.log(content);
  }
};
