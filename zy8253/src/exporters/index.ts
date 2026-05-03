import * as fs from 'fs';
import * as path from 'path';
import { RiskItem, AnalysisResult, ValidationResult, BatterySlotSession } from '../types';

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const strValue = String(value);
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  return strValue;
}

export function exportRiskItemsToCsv(riskItems: RiskItem[], outputPath: string): void {
  const headers = [
    'riskId',
    'batteryId',
    'cabinetId',
    'slotId',
    'riskType',
    'severity',
    'startTime',
    'endTime',
    'description',
    'relatedEventIds',
    'temperatureSlope',
    'maxTemperature',
    'status',
    'closedBy',
    'closedAt',
  ];

  const rows = riskItems.map((risk) => [
    risk.riskId,
    risk.batteryId,
    risk.cabinetId,
    risk.slotId,
    risk.riskType,
    risk.severity,
    risk.startTime,
    risk.endTime || '',
    risk.description,
    risk.relatedEventIds.join(';'),
    risk.temperatureSlope?.toString() || '',
    risk.maxTemperature?.toString() || '',
    risk.status,
    risk.closedBy || '',
    risk.closedAt || '',
  ]);

  const csvContent = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');

  fs.writeFileSync(outputPath, csvContent, 'utf-8');
}

function formatDate(date: Date): string {
  return date.toISOString();
}

function generateSessionSummary(sessions: BatterySlotSession[]): string {
  if (sessions.length === 0) {
    return '无电池仓位会话数据';
  }

  const activeSessions = sessions.filter((s) => !s.outTime);
  const completedSessions = sessions.filter((s) => s.outTime);
  const sessionsWithGaps = sessions.filter((s) => s.hasSensorGap);

  let content = `\n## 电池仓位会话概览\n\n`;
  content += `- **总会话数**: ${sessions.length}\n`;
  content += `- **进行中会话**: ${activeSessions.length}\n`;
  content += `- **已完成会话**: ${completedSessions.length}\n`;
  content += `- **存在传感器断采的会话**: ${sessionsWithGaps.length}\n\n`;

  if (sessionsWithGaps.length > 0) {
    content += `### 存在传感器问题的会话\n\n`;
    content += `| 电池ID | 换电柜 | 仓位 | 入柜时间 | 传感器断采时长(分钟) |\n`;
    content += `|--------|--------|------|----------|----------------------|\n`;
    for (const session of sessionsWithGaps) {
      content += `| ${session.batteryId} | ${session.cabinetId} | ${session.slotId} | ${formatDate(session.inTime)} | ${session.sensorGapMinutes} |\n`;
    }
    content += '\n';
  }

  return content;
}

function generateRiskSummary(riskItems: RiskItem[]): string {
  if (riskItems.length === 0) {
    return '\n## 风险项概览\n\n**未检测到任何风险项**\n';
  }

  const risksByType: Record<string, RiskItem[]> = {};
  const risksBySeverity: Record<string, RiskItem[]> = {};

  for (const risk of riskItems) {
    if (!risksByType[risk.riskType]) {
      risksByType[risk.riskType] = [];
    }
    risksByType[risk.riskType].push(risk);

    if (!risksBySeverity[risk.severity]) {
      risksBySeverity[risk.severity] = [];
    }
    risksBySeverity[risk.severity].push(risk);
  }

  let content = `\n## 风险项概览\n\n`;
  content += `### 按风险类型统计\n\n`;
  content += `| 风险类型 | 数量 |\n`;
  content += `|----------|------|\n`;
  for (const [type, items] of Object.entries(risksByType)) {
    content += `| ${type} | ${items.length} |\n`;
  }

  content += `\n### 按严重程度统计\n\n`;
  content += `| 严重程度 | 数量 |\n`;
  content += `|----------|------|\n`;
  for (const [severity, items] of Object.entries(risksBySeverity)) {
    content += `| ${severity} | ${items.length} |\n`;
  }

  content += `\n### 详细风险项列表\n\n`;

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const sortedSeverities = Object.keys(risksBySeverity).sort(
    (a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b)
  );

  for (const severity of sortedSeverities) {
    const items = risksBySeverity[severity];
    if (!items || items.length === 0) continue;

    content += `\n#### ${severity.toUpperCase()} 级别风险\n\n`;

    for (const risk of items) {
      content += `**风险ID**: ${risk.riskId}\n\n`;
      content += `- **电池ID**: ${risk.batteryId}\n`;
      content += `- **换电柜**: ${risk.cabinetId}\n`;
      content += `- **仓位**: ${risk.slotId}\n`;
      content += `- **风险类型**: ${risk.riskType}\n`;
      content += `- **开始时间**: ${risk.startTime}\n`;
      if (risk.endTime) {
        content += `- **结束时间**: ${risk.endTime}\n`;
      }
      if (risk.temperatureSlope !== undefined) {
        content += `- **温度斜率**: ${risk.temperatureSlope.toFixed(3)}°C/分钟\n`;
      }
      if (risk.maxTemperature !== undefined) {
        content += `- **最高温度**: ${risk.maxTemperature}°C\n`;
      }
      content += `- **状态**: ${risk.status}\n`;
      content += `\n**描述**: ${risk.description}\n\n`;
      content += `---\n\n`;
    }
  }

  return content;
}

export function exportThermalReview(
  analysisResult: AnalysisResult,
  validationResult: ValidationResult,
  outputPath: string,
  reviewDate?: Date
): void {
  const date = reviewDate || new Date();
  const dateStr = date.toISOString().split('T')[0];

  let markdown = `# 换电柜热失控早期复盘报告\n\n`;
  markdown += `**生成日期**: ${date.toISOString()}\n\n`;
  markdown += `---\n\n`;

  markdown += `## 数据验证概览\n\n`;
  if (validationResult.isValid) {
    markdown += `**数据验证状态**: ✅ 通过\n\n`;
  } else {
    markdown += `**数据验证状态**: ⚠️ 存在错误\n\n`;
    markdown += `**错误数量**: ${validationResult.errors.length}\n\n`;
  }

  markdown += `**警告数量**: ${validationResult.warnings.length}\n\n`;

  markdown += `### 数据统计\n\n`;
  markdown += `| 数据类型 | 数量 |\n`;
  markdown += `|----------|------|\n`;
  markdown += `| 换电柜 | ${validationResult.stats.totalCabinets} |\n`;
  markdown += `| 温度记录 | ${validationResult.stats.totalTemperatureRecords} |\n`;
  markdown += `| 换电事件 | ${validationResult.stats.totalSwapEvents} |\n`;
  markdown += `| 电池注册 | ${validationResult.stats.totalBatteries} |\n`;
  markdown += `| 告警规则 | ${validationResult.stats.totalRules} |\n\n`;

  if (validationResult.errors.length > 0) {
    markdown += `### 验证错误\n\n`;
    for (const error of validationResult.errors) {
      markdown += `- **${error.field}**: ${error.message}`;
      if (error.rowNumber) {
        markdown += ` (行 ${error.rowNumber})`;
      }
      if (error.value !== undefined) {
        markdown += `, 值: ${error.value}`;
      }
      markdown += `\n`;
    }
    markdown += `\n`;
  }

  if (validationResult.warnings.length > 0) {
    markdown += `### 验证警告\n\n`;
    for (const warning of validationResult.warnings) {
      markdown += `- **${warning.field}**: ${warning.message}`;
      if (warning.rowNumber) {
        markdown += ` (行 ${warning.rowNumber})`;
      }
      if (warning.value !== undefined) {
        markdown += `, 值: ${warning.value}`;
      }
      markdown += `\n`;
    }
    markdown += `\n`;
  }

  markdown += `---\n\n`;

  markdown += `## 分析结果概览\n\n`;
  markdown += `| 指标 | 数值 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总会话数 | ${analysisResult.summary.totalSessions} |\n`;
  markdown += `| 总风险项 | ${analysisResult.summary.totalRisks} |\n`;
  markdown += `| 已关闭告警 | ${analysisResult.summary.alertsClosed} |\n`;
  markdown += `| 进行中告警 | ${analysisResult.summary.alertsOpen} |\n\n`;

  if (Object.keys(analysisResult.summary.risksByType).length > 0) {
    markdown += `### 风险类型分布\n\n`;
    markdown += `| 风险类型 | 数量 |\n`;
    markdown += `|----------|------|\n`;
    for (const [type, count] of Object.entries(analysisResult.summary.risksByType)) {
      markdown += `| ${type} | ${count} |\n`;
    }
    markdown += `\n`;
  }

  if (Object.keys(analysisResult.summary.risksBySeverity).length > 0) {
    markdown += `### 风险严重程度分布\n\n`;
    markdown += `| 严重程度 | 数量 |\n`;
    markdown += `|----------|------|\n`;
    for (const [severity, count] of Object.entries(analysisResult.summary.risksBySeverity)) {
      markdown += `| ${severity} | ${count} |\n`;
    }
    markdown += `\n`;
  }

  markdown += `---\n\n`;

  markdown += generateSessionSummary(analysisResult.batterySessions);

  markdown += `---\n\n`;

  markdown += generateRiskSummary(analysisResult.riskItems);

  markdown += `\n---\n\n`;
  markdown += `*此报告由 thermal-review-cli 工具自动生成*\n`;

  fs.writeFileSync(outputPath, markdown, 'utf-8');
}

export function exportAllResults(
  analysisResult: AnalysisResult,
  validationResult: ValidationResult,
  outputDir: string
): { riskItemsPath: string; thermalReviewPath: string } {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const riskItemsPath = path.join(outputDir, 'risk_items.csv');
  const thermalReviewPath = path.join(outputDir, 'thermal_review.md');

  exportRiskItemsToCsv(analysisResult.riskItems, riskItemsPath);
  exportThermalReview(analysisResult, validationResult, thermalReviewPath);

  return { riskItemsPath, thermalReviewPath };
}
