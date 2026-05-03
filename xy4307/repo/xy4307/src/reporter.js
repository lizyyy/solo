import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { stringify } from 'csv-stringify/sync';

export function generateMarkdownReport(result, outputPath) {
  const processedAt = new Date(result.processedAt).toLocaleString('zh-CN');
  
  let content = `# 培养箱巡检报告

**生成时间**: ${processedAt}

---

## 一、处理概览

| 项目 | 数量 |
|------|------|
| 设备数据记录 | ${result.totalDeviceRecords || 0} |
| 批次记录 | ${result.totalBatchRecords || 0} |
| 合并记录 | ${result.mergedRecordsCount || 0} |
| 异常总数 | ${result.anomalySummary?.total || 0} |

---

## 二、异常统计

### 按类型统计

`;

  if (result.anomalySummary?.byType && Object.keys(result.anomalySummary.byType).length > 0) {
    content += `| 异常类型 | 数量 |
|----------|------|
`;
    for (const [type, count] of Object.entries(result.anomalySummary.byType)) {
      const typeName = getAnomalyTypeName(type);
      content += `| ${typeName} | ${count} |
`;
    }
  } else {
    content += `无异常记录。\n`;
  }

  content += `
### 按严重程度统计

`;

  if (result.anomalySummary?.bySeverity && Object.keys(result.anomalySummary.bySeverity).length > 0) {
    content += `| 严重程度 | 数量 |
|----------|------|
`;
    for (const [severity, count] of Object.entries(result.anomalySummary.bySeverity)) {
      content += `| ${getSeverityName(severity)} | ${count} |
`;
    }
  } else {
    content += `无异常记录。\n`;
  }

  content += `
### 按箱号统计

`;

  if (result.anomalySummary?.byBoxId && Object.keys(result.anomalySummary.byBoxId).length > 0) {
    content += `| 箱号 | 异常数量 |
|------|----------|
`;
    for (const [boxId, count] of Object.entries(result.anomalySummary.byBoxId)) {
      content += `| ${boxId} | ${count} |
`;
    }
  } else {
    content += `无异常记录。\n`;
  }

  content += `
---

## 三、异常详情

`;

  if (result.anomalies && result.anomalies.length > 0) {
    const groupedAnomalies = groupAnomaliesByType(result.anomalies);
    
    for (const [type, anomalies] of Object.entries(groupedAnomalies)) {
      content += `### ${getAnomalyTypeName(type)}

`;
      
      for (const anomaly of anomalies) {
        content += formatAnomalyDetail(anomaly);
        content += '\n';
      }
    }
  } else {
    content += `本次处理未检测到异常。\n`;
  }

  content += `
---

## 四、涉及箱号

`;

  if (result.boxIds && result.boxIds.length > 0) {
    content += `本次处理涉及以下箱号: ${result.boxIds.join(', ')}\n\n`;
  }

  content += `## 五、涉及批次

`;

  if (result.batchIds && result.batchIds.length > 0) {
    content += `本次处理涉及以下批次: ${result.batchIds.join(', ')}\n\n`;
  }

  content += `
---

*报告由培养箱巡检日志整理器自动生成*
`;

  ensureDirectory(outputPath);
  writeFileSync(outputPath, content, 'utf-8');
  
  return outputPath;
}

export function generateCSVSummary(result, outputPath) {
  const processedAt = new Date(result.processedAt).toISOString();
  
  const summaryRecords = [];
  
  if (result.anomalies && result.anomalies.length > 0) {
    for (const anomaly of result.anomalies) {
      summaryRecords.push({
        处理时间: processedAt,
        箱号: anomaly.boxId || '-',
        批次号: anomaly.batchId || '-',
        异常类型: getAnomalyTypeName(anomaly.type),
        严重程度: getSeverityName(anomaly.severity),
        描述: anomaly.description,
        时间: formatAnomalyTime(anomaly)
      });
    }
  }

  const csvContent = stringify(summaryRecords, {
    header: true,
    encoding: 'utf-8'
  });

  ensureDirectory(outputPath);
  writeFileSync(outputPath, '\uFEFF' + csvContent, 'utf-8');
  
  return outputPath;
}

export function generateReviewList(result, outputPath) {
  const processedAt = new Date(result.processedAt).toISOString();
  
  const reviewItems = [];
  
  if (result.anomalies && result.anomalies.length > 0) {
    for (const anomaly of result.anomalies) {
      reviewItems.push({
        序号: reviewItems.length + 1,
        箱号: anomaly.boxId || '-',
        批次号: anomaly.batchId || '-',
        异常类型: getAnomalyTypeName(anomaly.type),
        严重程度: getSeverityName(anomaly.severity),
        描述: anomaly.description,
        时间: formatAnomalyTime(anomaly),
        复核状态: '待复核',
        复核人: '',
        复核备注: ''
      });
    }
  }

  let content = `# 待复核清单

**生成时间**: ${new Date(processedAt).toLocaleString('zh-CN')}

---

## 待复核项目汇总

| 序号 | 箱号 | 批次 | 异常类型 | 严重程度 | 描述 |
|------|------|------|----------|----------|------|
`;

  for (const item of reviewItems) {
    content += `| ${item.序号} | ${item.箱号} | ${item.批次号} | ${item.异常类型} | ${item.严重程度} | ${item.描述} |
`;
  }

  content += `
---

## 详细复核表

`;

  for (const item of reviewItems) {
    content += `### 项目 ${item.序号}

| 字段 | 内容 |
|------|------|
| 箱号 | ${item.箱号} |
| 批次号 | ${item.批次号} |
| 异常类型 | ${item.异常类型} |
| 严重程度 | ${item.严重程度} |
| 发生时间 | ${item.时间} |
| 描述 | ${item.描述} |
| 复核状态 | ${item.复核状态} |
| 复核人 | ${item.复核人} |
| 复核备注 | ${item.复核备注} |

---

`;
  }

  ensureDirectory(outputPath);
  writeFileSync(outputPath, content, 'utf-8');
  
  return outputPath;
}

function getAnomalyTypeName(type) {
  const typeMap = {
    'SENSOR_GAP': '传感器断点',
    'TEMPERATURE_VIOLATION': '温度越界',
    'HUMIDITY_VIOLATION': '湿度越界',
    'DOOR_RECOVERY_TIMEOUT': '开门恢复超时',
    'DOOR_STILL_OPEN': '门未关闭',
    'DUPLICATE_RECORD': '重复记录',
    'BATCH_TIME_WINDOW_MISSING': '批次时间窗缺失'
  };
  return typeMap[type] || type;
}

function getSeverityName(severity) {
  const severityMap = {
    'ERROR': '错误',
    'WARNING': '警告',
    'INFO': '信息'
  };
  return severityMap[severity] || severity;
}

function formatAnomalyTime(anomaly) {
  if (anomaly.startTime && anomaly.endTime) {
    return `${formatDate(anomaly.startTime)} 至 ${formatDate(anomaly.endTime)}`;
  }
  if (anomaly.timestamp) {
    return formatDate(anomaly.timestamp);
  }
  if (anomaly.openTimestamp) {
    if (anomaly.closeTimestamp) {
      return `${formatDate(anomaly.openTimestamp)} 至 ${formatDate(anomaly.closeTimestamp)}`;
    }
    return formatDate(anomaly.openTimestamp);
  }
  if (anomaly.startTime) {
    if (anomaly.endTime) {
      return `${formatDate(anomaly.startTime)} 至 ${formatDate(anomaly.endTime)}`;
    }
    return formatDate(anomaly.startTime);
  }
  return '-';
}

function formatDate(dateVal) {
  if (!dateVal) return '-';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return String(dateVal);
  return date.toLocaleString('zh-CN');
}

function groupAnomaliesByType(anomalies) {
  const groups = {};
  for (const anomaly of anomalies) {
    if (!groups[anomaly.type]) {
      groups[anomaly.type] = [];
    }
    groups[anomaly.type].push(anomaly);
  }
  return groups;
}

function formatAnomalyDetail(anomaly) {
  let detail = `**【${getSeverityName(anomaly.severity)}】** ${anomaly.description}\n\n`;
  
  detail += `- 箱号: ${anomaly.boxId || '-'}\n`;
  
  if (anomaly.batchId) {
    detail += `- 批次号: ${anomaly.batchId}\n`;
  }
  
  detail += `- 时间: ${formatAnomalyTime(anomaly)}\n`;
  
  if (anomaly.temperature !== undefined) {
    detail += `- 温度: ${anomaly.temperature}°C (范围: ${anomaly.expectedMin}-${anomaly.expectedMax}°C)\n`;
  }
  
  if (anomaly.humidity !== undefined) {
    detail += `- 湿度: ${anomaly.humidity}% (范围: ${anomaly.expectedMin}-${anomaly.expectedMax}%)\n`;
  }
  
  if (anomaly.gapMinutes !== undefined) {
    detail += `- 间隔: ${anomaly.gapMinutes} 分钟\n`;
  }
  
  if (anomaly.recoveryMinutes !== undefined) {
    detail += `- 恢复时间: ${anomaly.recoveryMinutes} 分钟 (阈值: ${anomaly.expectedRecoveryMinutes} 分钟)\n`;
  }
  
  return detail;
}

function ensureDirectory(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
