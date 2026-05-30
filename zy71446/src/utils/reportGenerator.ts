import { Anomaly, ConflictLog, Report, EvidenceItem } from '../types/anomalies';
import { CrowdDataPoint } from '../types/simulation';
import { Escalator, Turnstile } from '../types/devices';
import { AnomalyDetector } from '../engine/AnomalyDetector';
import { ConflictResolver } from '../engine/ConflictResolver';
import { generateTimestamp, timeToMinutes, minutesToTime } from './timeUtils';
import { STATION_ID, STATION_NAME } from '../data/stationConfig';

export interface ReportOptions {
  startTime: string;
  endTime: string;
  operator: string;
  scenario: string;
  notes?: string;
}

interface CrowdDistributionData {
  zoneId: string;
  currentCount: number;
  maxCapacity: number;
  density: number;
  flowIn: number;
  flowOut: number;
}

export function generateReport(
  currentTime: string,
  startTime: string,
  endTime: string,
  anomalies: Anomaly[],
  conflicts: ConflictLog[],
  crowdDistribution: Map<string, CrowdDistributionData>,
  escalators: Escalator[],
  turnstiles: Turnstile[]
): Report {
  const sortedAnomalies = [...anomalies].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const sortedConflicts = [...conflicts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const highRiskAnomalies = sortedAnomalies.filter(
    (a) => a.severity === 'high' && a.status !== 'resolved'
  ).length;
  const mediumRiskAnomalies = sortedAnomalies.filter(
    (a) => a.severity === 'medium' && a.status !== 'resolved'
  ).length;

  const reportAnomalies = sortedAnomalies.map((a) => ({
    id: a.id,
    type: a.type,
    severity: a.severity,
    time: a.startTime,
    description: `${a.location} - ${AnomalyDetector.getAnomalyTypeName(a.type)}`,
    evidenceChain: a.evidence as EvidenceItem[],
    recommendation: a.severity === 'high'
      ? '建议立即采取措施疏散客流'
      : '建议持续关注并准备应对措施',
  }));

  const recommendations = generateSuggestions({
    events: sortedAnomalies,
    conflicts: sortedConflicts,
  } as Report);

  return {
    id: `report_${Date.now()}`,
    generatedAt: generateTimestamp(),
    timeRange: {
      start: startTime,
      end: endTime,
    },
    events: sortedAnomalies,
    conflicts: sortedConflicts,
    exportFormat: 'json',
    metadata: {
      operator: '系统自动生成',
      stationId: STATION_ID,
      scenario: '早高峰模拟',
      generatedAt: generateTimestamp(),
      timeRange: `${startTime} - ${endTime}`,
    },
    summary: {
      highRiskAnomalies,
      mediumRiskAnomalies,
      conflicts: conflicts.length,
    },
    anomalies: reportAnomalies,
    recommendations,
  };
}

export function generateReportMarkdown(report: Report): string {
  const lines: string[] = [];

  lines.push(`# 地铁换乘人流异常报告`);
  lines.push('');
  lines.push(`**生成时间**: ${report.generatedAt}`);
  lines.push(`**站点**: ${STATION_NAME} (${report.metadata.stationId})`);
  lines.push(`**时段**: ${report.timeRange.start} - ${report.timeRange.end}`);
  lines.push(`**操作人员**: ${report.metadata.operator}`);
  lines.push(`**场景**: ${report.metadata.scenario}`);
  if (report.metadata.notes) {
    lines.push(`**备注**: ${report.metadata.notes}`);
  }
  lines.push('');

  lines.push(`## 概览`);
  lines.push('');
  const highCount = report.events.filter((e) => e.severity === 'high' && e.status !== 'resolved').length;
  const mediumCount = report.events.filter((e) => e.severity === 'medium' && e.status !== 'resolved').length;
  const resolvedCount = report.events.filter((e) => e.status === 'resolved').length;
  const conflictCount = report.conflicts.length;
  const pendingConflicts = report.conflicts.filter((c) => c.resolution === 'pending').length;

  lines.push(`| 指标 | 数值 |`);
  lines.push(`|------|------|`);
  lines.push(`| 严重异常 | ${highCount} |`);
  lines.push(`| 中等异常 | ${mediumCount} |`);
  lines.push(`| 已解决 | ${resolvedCount} |`);
  lines.push(`| 数据冲突 | ${conflictCount} |`);
  lines.push(`| 待处理冲突 | ${pendingConflicts} |`);
  lines.push('');

  lines.push(`## 异常事件时间线`);
  lines.push('');

  report.events.forEach((event, index) => {
    const typeName = AnomalyDetector.getAnomalyTypeName(event.type);
    const severityName = AnomalyDetector.getSeverityName(event.severity);
    const statusText = event.status === 'active' ? '进行中' : event.status === 'acknowledged' ? '已确认' : '已解决';
    const color = AnomalyDetector.getAnomalyColor(event.type);

    lines.push(`### ${index + 1}. ${typeName} [${severityName}] - ${event.location}`);
    lines.push('');
    lines.push(`- **状态**: <span style="color:${color}">${statusText}</span>`);
    lines.push(`- **开始时间**: ${event.startTime}`);
    if (event.endTime) {
      lines.push(`- **结束时间**: ${event.endTime}`);
      const duration = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
      lines.push(`- **持续时间**: ${duration} 分钟`);
    }
    lines.push('');
    lines.push(`#### 峰值数据`);
    lines.push('');
    Object.entries(event.peakData).forEach(([key, value]) => {
      lines.push(`- ${formatDataKey(key)}: ${formatDataValue(key, value)}`);
    });
    lines.push('');

    if (event.evidence.length > 0) {
      lines.push(`#### 证据链`);
      lines.push('');
      event.evidence.forEach((ev, idx) => {
        lines.push(`${idx + 1}. **${ev.source}** (置信度: ${(ev.confidence * 100).toFixed(0)}%)`);
        lines.push(`   - 时间: ${ev.timestamp}`);
        lines.push(`   - 数据: \`${JSON.stringify(ev.data)}\``);
      });
      lines.push('');
    }

    if (event.resolutionNotes) {
      lines.push(`#### 处理记录`);
      lines.push('');
      lines.push(event.resolutionNotes);
      lines.push('');
    }
  });

  if (report.conflicts.length > 0) {
    lines.push(`## 数据冲突留痕记录`);
    lines.push('');

    report.conflicts.forEach((conflict, index) => {
      const typeName = ConflictResolver.getConflictTypeName(conflict.conflictType);
      const statusName = ConflictResolver.getResolutionStatusName(conflict.resolution);

      lines.push(`### ${index + 1}. ${typeName}`);
      lines.push('');
      lines.push(`- **时间**: ${conflict.timestamp}`);
      lines.push(`- **状态**: ${statusName}`);
      if (conflict.resolvedBy) {
        lines.push(`- **处理人**: ${conflict.resolvedBy}`);
      }
      if (conflict.resolvedAt) {
        lines.push(`- **处理时间**: ${conflict.resolvedAt}`);
      }
      lines.push('');

      lines.push(`#### 数据源对比`);
      lines.push('');
      lines.push(`| 数据源 | 置信度 | 原始数据 |`);
      lines.push(`|--------|--------|----------|`);

      if (conflict.sources.concourse) {
        lines.push(`| 站厅主信息 | ${(conflict.confidenceScores.concourse * 100).toFixed(0)}% | \`${JSON.stringify(conflict.sources.concourse)}\` |`);
      }
      if (conflict.sources.turnstile) {
        lines.push(`| 闸机数据 | ${(conflict.confidenceScores.turnstile * 100).toFixed(0)}% | \`${JSON.stringify(conflict.sources.turnstile)}\` |`);
      }
      if (conflict.sources.escalator) {
        lines.push(`| 扶梯数据 | ${(conflict.confidenceScores.escalator * 100).toFixed(0)}% | \`${JSON.stringify(conflict.sources.escalator)}\` |`);
      }
      lines.push('');

      if (conflict.notes) {
        lines.push(`#### 处理说明`);
        lines.push('');
        lines.push(conflict.notes);
        lines.push('');
      }
    });
  }

  lines.push(`## 运营建议`);
  lines.push('');
  const suggestions = generateSuggestions(report);
  suggestions.forEach((s, i) => {
    lines.push(`${i + 1}. ${s}`);
  });
  lines.push('');

  lines.push(`---`);
  lines.push(`*本报告由地铁换乘人流沙盘系统自动生成*`);

  return lines.join('\n');
}

function formatDataKey(key: string): string {
  const names: Record<string, string> = {
    count: '人数',
    capacity: '容量',
    percentage: '占比',
    duration: '持续时间(分钟)',
    currentDirection: '当前方向',
    expectedDirection: '预期方向',
    passengerCount: '影响人数',
    directionContrast: '方向对比度',
    status: '状态',
    hasMaintenance: '有检修记录',
    diffPercentage: '差异百分比(%)',
    concourseCount: '站厅计数',
    estimatedFromDevices: '设备估算',
    reflowPercentage: '回流比例(%)',
    affectedPassengers: '影响乘客数',
  };
  return names[key] || key;
}

function formatDataValue(key: string, value: number | string | boolean): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (key === 'percentage' || key === 'diffPercentage' || key === 'reflowPercentage') {
    return `${value.toFixed(1)}%`;
  }
  if (value % 1 !== 0) {
    return value.toFixed(2);
  }
  return String(value);
}

function generateSuggestions(report: Report): string[] {
  const suggestions: string[] = [];
  const activeHigh = report.events.filter((e) => e.severity === 'high' && e.status === 'active');

  if (activeHigh.some((e) => e.type === 'over_capacity')) {
    suggestions.push('建议启动站厅限流措施，在入口处安排人员引导分流');
  }

  if (activeHigh.some((e) => e.type === 'wrong_direction')) {
    suggestions.push('立即检查并调整扶梯运行方向，确保与早高峰客流方向一致');
  }

  if (activeHigh.some((e) => e.type === 'reflow')) {
    suggestions.push('客流回流现象明显，建议增派人员在通道处进行疏导');
  }

  if (report.events.some((e) => e.type === 'escalator_stop' && e.status !== 'resolved')) {
    suggestions.push('停运扶梯影响通行效率，建议尽快安排检修，并在附近设置临时引导标识');
  }

  const pendingConflicts = report.conflicts.filter((c) => c.resolution === 'pending');
  if (pendingConflicts.length > 0) {
    suggestions.push(`存在 ${pendingConflicts.length} 个数据冲突待处理，建议尽快人工复核`);
  }

  if (suggestions.length === 0) {
    suggestions.push('当前时段运营状态良好，建议持续监控关键区域客流变化');
  }

  return suggestions;
}

export function exportReportAsJSON(report: Report, filename?: string): string {
  const json = JSON.stringify(report, null, 2);
  if (filename) {
    downloadFile(json, filename, 'application/json');
  }
  return json;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
