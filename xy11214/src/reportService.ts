import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { createObjectCsvWriter } from 'csv-writer';
import { all, InspectionRecord, SensorAlert } from './database';
import { getAllInspections, getAllAlerts } from './reviewService';

export interface StatisticsReport {
  totalInspections: number;
  inspectionsByStatus: Record<string, number>;
  inspectionsByReviewStatus: Record<string, number>;
  totalAlerts: number;
  alertsByLevel: Record<string, number>;
  unacknowledgedAlerts: number;
  pendingReviews: number;
  period: {
    start: string;
    end: string;
  };
}

export async function generateStatistics(startDate?: string, endDate?: string): Promise<StatisticsReport> {
  const start = startDate || '1970-01-01';
  const end = endDate || format(new Date(), 'yyyy-MM-dd HH:mm:ss');

  const inspectionsByStatusRows = await all<{ status: string; count: number }>(`
    SELECT status, COUNT(*) as count
    FROM inspection_records
    WHERE inspectionDate BETWEEN ? AND ?
    GROUP BY status
  `, [start, end]);

  const inspectionsByReviewStatusRows = await all<{ reviewStatus: string; count: number }>(`
    SELECT reviewStatus, COUNT(*) as count
    FROM inspection_records
    WHERE inspectionDate BETWEEN ? AND ?
    GROUP BY reviewStatus
  `, [start, end]);

  const alertsByLevelRows = await all<{ alertLevel: string; count: number }>(`
    SELECT alertLevel, COUNT(*) as count
    FROM sensor_alerts
    WHERE alertTime BETWEEN ? AND ?
    GROUP BY alertLevel
  `, [start, end]);

  const totalInspectionsResult = await all<{ count: number }>(`
    SELECT COUNT(*) as count FROM inspection_records
    WHERE inspectionDate BETWEEN ? AND ?
  `, [start, end]);

  const totalAlertsResult = await all<{ count: number }>(`
    SELECT COUNT(*) as count FROM sensor_alerts
    WHERE alertTime BETWEEN ? AND ?
  `, [start, end]);

  const unacknowledgedResult = await all<{ count: number }>(`
    SELECT COUNT(*) as count FROM sensor_alerts
    WHERE isAcknowledged = 0 AND alertTime BETWEEN ? AND ?
  `, [start, end]);

  const pendingResult = await all<{ count: number }>(`
    SELECT COUNT(*) as count FROM inspection_records
    WHERE reviewStatus = 'pending' AND inspectionDate BETWEEN ? AND ?
  `, [start, end]);

  return {
    totalInspections: totalInspectionsResult[0]?.count || 0,
    inspectionsByStatus: Object.fromEntries(inspectionsByStatusRows.map(r => [r.status, r.count])),
    inspectionsByReviewStatus: Object.fromEntries(inspectionsByReviewStatusRows.map(r => [r.reviewStatus, r.count])),
    totalAlerts: totalAlertsResult[0]?.count || 0,
    alertsByLevel: Object.fromEntries(alertsByLevelRows.map(r => [r.alertLevel, r.count])),
    unacknowledgedAlerts: unacknowledgedResult[0]?.count || 0,
    pendingReviews: pendingResult[0]?.count || 0,
    period: { start, end }
  };
}

export function formatReport(report: StatisticsReport): string {
  const lines = [
    '='.repeat(60),
    '            地下泵房巡检系统 - 统计报告',
    '='.repeat(60),
    '',
    `统计周期: ${report.period.start} 至 ${report.period.end}`,
    '',
    '-'.repeat(60),
    '【巡检记录统计】',
    `- 总记录数: ${report.totalInspections}`,
    `- 待复核: ${report.pendingReviews}`,
    '',
    '  按状态分布:',
  ];

  const statusLabels: Record<string, string> = {
    normal: '正常',
    warning: '警告',
    error: '异常',
    critical: '严重'
  };
  for (const [status, count] of Object.entries(report.inspectionsByStatus)) {
    lines.push(`    ${statusLabels[status] || status}: ${count}`);
  }

  const reviewLabels: Record<string, string> = {
    pending: '待复核',
    reviewed: '已复核',
    resolved: '已处理'
  };
  lines.push('', '  按复核状态分布:');
  for (const [status, count] of Object.entries(report.inspectionsByReviewStatus)) {
    lines.push(`    ${reviewLabels[status] || status}: ${count}`);
  }

  lines.push(
    '',
    '-'.repeat(60),
    '【传感器告警统计】',
    `- 总告警数: ${report.totalAlerts}`,
    `- 未确认: ${report.unacknowledgedAlerts}`,
    '',
    '  按告警级别分布:'
  );

  const levelLabels: Record<string, string> = {
    info: '信息',
    warning: '警告',
    critical: '严重'
  };
  for (const [level, count] of Object.entries(report.alertsByLevel)) {
    lines.push(`    ${levelLabels[level] || level}: ${count}`);
  }

  lines.push(
    '',
    '-'.repeat(60),
    '【需要关注的事项】'
  );

  let hasIssues = false;
  if (report.pendingReviews > 0) {
    lines.push(`  ⚠️  有 ${report.pendingReviews} 条巡检记录待复核`);
    hasIssues = true;
  }
  if (report.unacknowledgedAlerts > 0) {
    lines.push(`  ⚠️  有 ${report.unacknowledgedAlerts} 条告警未确认`);
    hasIssues = true;
  }
  if ((report.inspectionsByStatus['critical'] || 0) > 0) {
    lines.push(`  🔴 有 ${report.inspectionsByStatus['critical']} 条严重异常巡检记录`);
    hasIssues = true;
  }
  if ((report.inspectionsByStatus['error'] || 0) > 0) {
    lines.push(`  🟠 有 ${report.inspectionsByStatus['error']} 条异常巡检记录`);
    hasIssues = true;
  }

  if (!hasIssues) {
    lines.push('  ✅ 一切正常，无需特别关注');
  }

  lines.push(
    '',
    '='.repeat(60),
    `报告生成时间: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
    '='.repeat(60)
  );

  return lines.join('\n');
}

export async function exportInspectionsToCSV(filePath: string, status?: InspectionRecord['status']): Promise<number> {
  const records = await getAllInspections(status);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'inspectionDate', title: '巡检日期' },
      { id: 'inspector', title: '巡检人' },
      { id: 'equipmentName', title: '设备名称' },
      { id: 'location', title: '位置' },
      { id: 'status', title: '状态' },
      { id: 'temperature', title: '温度' },
      { id: 'pressure', title: '压力' },
      { id: 'vibration', title: '振动' },
      { id: 'remarks', title: '备注' },
      { id: 'reviewStatus', title: '复核状态' },
      { id: 'reviewedBy', title: '复核人' },
      { id: 'reviewedAt', title: '复核时间' },
      { id: 'createdAt', title: '创建时间' }
    ]
  });

  await csvWriter.writeRecords(records.map(r => ({
    ...r,
    status: r.status === 'normal' ? '正常' : r.status === 'warning' ? '警告' : r.status === 'error' ? '异常' : '严重',
    reviewStatus: r.reviewStatus === 'pending' ? '待复核' : r.reviewStatus === 'reviewed' ? '已复核' : '已处理'
  })));

  return records.length;
}

export async function exportAlertsToCSV(filePath: string, alertLevel?: SensorAlert['alertLevel']): Promise<number> {
  const alerts = await getAllAlerts(alertLevel);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'sensorId', title: '传感器ID' },
      { id: 'sensorType', title: '传感器类型' },
      { id: 'location', title: '位置' },
      { id: 'alertLevel', title: '告警级别' },
      { id: 'value', title: '数值' },
      { id: 'threshold', title: '阈值' },
      { id: 'alertTime', title: '告警时间' },
      { id: 'isAcknowledged', title: '是否确认' },
      { id: 'acknowledgedBy', title: '确认人' },
      { id: 'acknowledgedAt', title: '确认时间' }
    ]
  });

  await csvWriter.writeRecords(alerts.map(a => ({
    ...a,
    alertLevel: a.alertLevel === 'info' ? '信息' : a.alertLevel === 'warning' ? '警告' : '严重',
    isAcknowledged: a.isAcknowledged ? '是' : '否'
  })));

  return alerts.length;
}

export function saveTextReport(filePath: string, report: string): void {
  fs.writeFileSync(filePath, report, 'utf-8');
}
