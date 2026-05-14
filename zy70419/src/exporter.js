import fs from 'fs/promises';
import path from 'path';

function exportToJSON(auditResult, options = {}) {
  const { includeRawInputs = true, includeSamples = true } = options;
  
  const exportData = {
    exportType: 'lab_audit_result',
    exportTime: new Date().toISOString(),
    version: '1.0.0',
    batchId: auditResult.batchId,
    operator: auditResult.operator,
    auditTime: auditResult.auditTime,
    summary: auditResult.summary,
    anomalies: auditResult.allAnomalies
  };
  
  if (includeRawInputs) {
    exportData.rawAudit = auditResult.rawAudit;
  }
  
  if (includeSamples) {
    exportData.sampleAudit = auditResult.sampleAudit;
  }
  
  return exportData;
}

function exportToMarkdown(auditResult) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  let md = `# 实验室样本单审核报告\n\n`;
  md += `> 导出时间: ${now}\n`;
  md += `> 批次ID: ${auditResult.batchId}\n`;
  md += `> 操作者: ${auditResult.operator}\n`;
  md += `> 审核时间: ${auditResult.auditTime.slice(0, 19).replace('T', ' ')}\n\n`;
  
  md += `## 审核摘要\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 原始数据总行数 | ${auditResult.summary.totalRawRows} |\n`;
  md += `| 正常行数 | ${auditResult.summary.cleanRows} |\n`;
  md += `| 脏行数 | ${auditResult.summary.dirtyRows} |\n`;
  md += `| 被吞掉的脏行数 | ${auditResult.summary.swallowedRows} |\n`;
  md += `| 格式错误行数 | ${auditResult.summary.malformedRows} |\n`;
  md += `| 样本总数 | ${auditResult.summary.totalSamples} |\n`;
  md += `| 正常样本数 | ${auditResult.summary.cleanSamples} |\n`;
  md += `| 含异常的样本数 | ${auditResult.summary.samplesWithAnomalies} |\n\n`;
  
  md += `## 异常明细\n\n`;
  
  if (auditResult.allAnomalies.length === 0) {
    md += `> 未发现异常\n\n`;
  } else {
    for (const anomaly of auditResult.allAnomalies) {
      md += `### 业务单号: ${anomaly.businessNo}\n\n`;
      md += `- **异常类型**: ${anomaly.type}\n`;
      md += `- **异常描述**: ${anomaly.message}\n`;
      
      if (anomaly.rawContent) {
        md += `- **原始内容**: \`${anomaly.rawContent}\`\n`;
      }
      
      if (anomaly.missingFields && anomaly.missingFields.length > 0) {
        md += `- **缺失字段**: ${anomaly.missingFields.join(', ')}\n`;
      }
      
      if (anomaly.field) {
        md += `- **异常字段**: ${anomaly.field}\n`;
        md += `- **异常值**: ${anomaly.value}\n`;
      }
      
      if (anomaly.sampleId) {
        md += `- **样本ID**: ${anomaly.sampleId}\n`;
      }
      
      md += '\n';
    }
  }
  
  md += `## 原始输入追溯\n\n`;
  md += `> 以下为所有原始输入行，可用于追溯问题来源\n\n`;
  
  for (const detail of auditResult.rawAudit.details) {
    const statusIcon = detail.status === 'clean' ? '✅' : '❌';
    md += `### ${statusIcon} 行号 ${detail.index} - ${detail.businessNo || '无业务号'}\n\n`;
    
    if (detail.rawContent) {
      md += `**原始内容**: \n\`\`\`\n${detail.rawContent}\n\`\`\`\n\n`;
    } else if (detail.originalLine) {
      md += `**原始行**: \`${detail.originalLine}\`\n\n`;
    }
    
    if (detail.isDirty) {
      md += `**问题类型**: ${detail.dirtyType}\n`;
      if (detail.missingFields && detail.missingFields.length > 0) {
        md += `**缺失字段**: ${detail.missingFields.join(', ')}\n`;
      }
      md += '\n';
    }
  }
  
  return md;
}

async function saveJSON(data, filePath) {
  const fullPath = path.resolve(filePath);
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');
  return fullPath;
}

async function saveMarkdown(content, filePath) {
  const fullPath = path.resolve(filePath);
  await fs.writeFile(fullPath, content, 'utf8');
  return fullPath;
}

function exportAnomalyList(auditResult) {
  return {
    batchId: auditResult.batchId,
    exportTime: new Date().toISOString(),
    totalAnomalies: auditResult.allAnomalies.length,
    anomalies: auditResult.allAnomalies.map(a => ({
      businessNo: a.businessNo,
      type: a.type,
      message: a.message,
      severity: a.type === 'swallowed' ? 'critical' : 
                a.type === 'malformed' ? 'high' : 
                a.type === 'data_anomaly' ? 'medium' : 'low'
    }))
  };
}

export {
  exportToJSON,
  exportToMarkdown,
  saveJSON,
  saveMarkdown,
  exportAnomalyList
};
