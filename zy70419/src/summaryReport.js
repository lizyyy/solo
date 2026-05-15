import { detectGatewayErrors } from './auditDetector.js';

function getAnomalies(auditResult) {
  return auditResult.allAnomalies || auditResult.anomalies || [];
}

function groupAnomaliesByBusinessNo(auditResult, gatewayErrors = []) {
  const grouped = new Map();
  
  const anomalies = getAnomalies(auditResult);
  for (const anomaly of anomalies) {
    const businessNo = anomaly.businessNo || '未知业务单号';
    if (!grouped.has(businessNo)) {
      grouped.set(businessNo, []);
    }
    grouped.get(businessNo).push(anomaly);
  }
  
  if (gatewayErrors.length > 0) {
    const systemGatewayErrors = [];
    
    for (const error of gatewayErrors) {
      const gatewayAnomaly = {
        type: 'gateway_error',
        code: error.code,
        message: error.message,
        businessNo: error.businessNo || null,
        rawLog: error.rawLog || null,
        detectedAt: error.detectedAt,
        isGatewayError: true
      };
      
      if (error.businessNo && grouped.has(error.businessNo)) {
        grouped.get(error.businessNo).push(gatewayAnomaly);
      } else if (error.businessNo) {
        if (!grouped.has(error.businessNo)) {
          grouped.set(error.businessNo, []);
        }
        grouped.get(error.businessNo).push(gatewayAnomaly);
      } else {
        systemGatewayErrors.push(gatewayAnomaly);
      }
    }
    
    if (systemGatewayErrors.length > 0) {
      const gatewayBusinessNo = `BATCH-${auditResult.batchId || '系统级'}`;
      if (!grouped.has(gatewayBusinessNo)) {
        grouped.set(gatewayBusinessNo, []);
      }
      for (const error of systemGatewayErrors) {
        grouped.get(gatewayBusinessNo).push(error);
      }
    }
  }
  
  return grouped;
}

function generateCorrectionSuggestion(anomaly) {
  const suggestions = {
    swallowed: '建议：该记录被系统自动过滤，需人工确认原始数据完整性，必要时重新导入',
    malformed: '建议：数据格式错误，需补全缺失字段或修正格式后重新处理',
    missing_fields: `建议：补充缺失字段：${anomaly.missingFields ? anomaly.missingFields.join(', ') : '未知字段'}`,
    data_anomaly: {
      invalid_age: '建议：核实患者年龄，修正为有效范围内的数值(0-150)',
      time_inversion: '建议：检查采集时间和接收时间，修正时间倒置问题'
    },
    gateway_error: '建议：检查网络连接和网关服务状态，必要时重试或联系运维'
  };
  
  if (anomaly.type === 'gateway_error') {
    return suggestions.gateway_error;
  }
  
  if (anomaly.type === 'data_anomaly') {
    if (anomaly.subtype) {
      return suggestions.data_anomaly[anomaly.subtype] || '建议：人工审核数据异常';
    }
    if (anomaly.message && anomaly.message.includes('时间')) {
      return suggestions.data_anomaly.time_inversion;
    }
    if (anomaly.message && anomaly.message.includes('年龄')) {
      return suggestions.data_anomaly.invalid_age;
    }
    return '建议：人工审核数据异常';
  }
  
  return suggestions[anomaly.type] || '建议：人工审核异常记录';
}

function generateConclusion(anomalies) {
  const hasCritical = anomalies.some(a => 
    a.type === 'swallowed' || a.type === 'gateway_error'
  );
  
  const hasHigh = anomalies.some(a => 
    a.type === 'malformed' || a.type === 'missing_fields'
  );
  
  const hasDataAnomaly = anomalies.some(a => a.type === 'data_anomaly');
  
  if (hasCritical) {
    return {
      level: 'critical',
      message: '存在严重异常，必须立即处理，否则可能导致数据丢失或业务中断'
    };
  } else if (hasHigh) {
    return {
      level: 'high',
      message: '存在较严重异常，建议优先处理，避免影响后续流程'
    };
  } else if (hasDataAnomaly) {
    return {
      level: 'medium',
      message: '存在数据异常，建议在下次批量处理前修正'
    };
  } else {
    return {
      level: 'low',
      message: '存在轻微异常，可在日常巡检中处理'
    };
  }
}

function generateSummaryReport(auditResult, gatewayLogs = '') {
  const gatewayErrors = detectGatewayErrors(gatewayLogs);
  const groupedAnomalies = groupAnomaliesByBusinessNo(auditResult, gatewayErrors);
  const allAnomaliesList = getAnomalies(auditResult);
  
  const report = {
    reportId: `RPT${Date.now()}`,
    generatedAt: new Date().toISOString(),
    batchId: auditResult.batchId,
    operator: auditResult.operator,
    summary: {
      totalBusinessNos: groupedAnomalies.size,
      totalAnomalies: allAnomaliesList.length + gatewayErrors.length,
      gatewayErrors: gatewayErrors.length,
      byLevel: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    },
    gatewayErrors,
    businessNoSummaries: []
  };
  
  for (const [businessNo, anomalies] of groupedAnomalies) {
    const conclusion = generateConclusion(anomalies);
    report.summary.byLevel[conclusion.level]++;
    
    const hasGatewayError = anomalies.some(a => a.isGatewayError);
    
    const businessNoSummary = {
      businessNo,
      anomalyCount: anomalies.length,
      hasGatewayError,
      conclusionLevel: conclusion.level,
      conclusion: conclusion.message,
      anomalies: anomalies.map(a => ({
        type: a.type,
        code: a.code || null,
        message: a.message,
        rawContent: a.rawContent || null,
        rawLog: a.rawLog || null,
        sampleId: a.sampleId || null,
        field: a.field || null,
        value: a.value || null,
        missingFields: a.missingFields || [],
        isGatewayError: a.isGatewayError || false
      })),
      corrections: anomalies.map(a => ({
        anomalyType: a.type,
        suggestion: generateCorrectionSuggestion(a)
      }))
    };
    
    report.businessNoSummaries.push(businessNoSummary);
  }
  
  report.businessNoSummaries.sort((a, b) => {
    const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (a.hasGatewayError && !b.hasGatewayError) return -1;
    if (!a.hasGatewayError && b.hasGatewayError) return 1;
    return levelOrder[a.conclusionLevel] - levelOrder[b.conclusionLevel];
  });
  
  return report;
}

function summaryReportToMarkdown(report) {
  let md = `# 实验室样本单审核摘要报告\n\n`;
  md += `> 报告ID: ${report.reportId}\n`;
  md += `> 生成时间: ${report.generatedAt.slice(0, 19).replace('T', ' ')}\n`;
  md += `> 批次ID: ${report.batchId}\n`;
  md += `> 操作者: ${report.operator}\n\n`;
  
  md += `## 总体摘要\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 异常业务单号数量 | ${report.summary.totalBusinessNos} |\n`;
  md += `| 总异常数 | ${report.summary.totalAnomalies} |\n`;
  md += `| 网关错误数 | ${report.summary.gatewayErrors} |\n\n`;
  
  md += `### 按严重程度分类\n\n`;
  md += `| 严重程度 | 业务单号数 |\n`;
  md += `|----------|------------|\n`;
  md += `| 🔴 严重 (Critical) | ${report.summary.byLevel.critical} |\n`;
  md += `| 🟠 高 (High) | ${report.summary.byLevel.high} |\n`;
  md += `| 🟡 中 (Medium) | ${report.summary.byLevel.medium} |\n`;
  md += `| 🟢 低 (Low) | ${report.summary.byLevel.low} |\n\n`;
  
  md += `## 按业务单号汇总（含网关错误）\n\n`;
  
  for (const summary of report.businessNoSummaries) {
    const levelIcon = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    }[summary.conclusionLevel];
    
    const gatewayIcon = summary.hasGatewayError ? ' ⚠️ 含网关错误' : '';
    
    md += `### ${levelIcon} 业务单号: ${summary.businessNo}${gatewayIcon}\n\n`;
    
    md += `#### 异常情况 (共${summary.anomalyCount}项)\n\n`;
    for (const anomaly of summary.anomalies) {
      const typeLabel = anomaly.isGatewayError ? '网关错误' : anomaly.type;
      md += `- **${typeLabel}**${anomaly.code ? ` [${anomaly.code}]` : ''}: ${anomaly.message}\n`;
      if (anomaly.rawLog) {
        md += `  - 原始日志: \`${anomaly.rawLog}\`\n`;
      }
      if (anomaly.rawContent) {
        md += `  - 原始内容: \`${anomaly.rawContent}\`\n`;
      }
      if (anomaly.sampleId) {
        md += `  - 样本ID: ${anomaly.sampleId}\n`;
      }
      if (anomaly.missingFields && anomaly.missingFields.length > 0) {
        md += `  - 缺失字段: ${anomaly.missingFields.join(', ')}\n`;
      }
    }
    md += '\n';
    
    md += `#### 修正建议\n\n`;
    for (const correction of summary.corrections) {
      md += `- **针对 ${correction.anomalyType}**: ${correction.suggestion}\n`;
    }
    md += '\n';
    
    md += `#### 结论\n\n`;
    md += `> ${summary.conclusion}\n\n`;
  }
  
  return md;
}

function summaryReportToJSON(report) {
  return {
    ...report,
    exportTime: new Date().toISOString()
  };
}

export {
  generateSummaryReport,
  summaryReportToMarkdown,
  summaryReportToJSON,
  groupAnomaliesByBusinessNo
};
