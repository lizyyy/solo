import fs from 'fs';
import { dao } from '../database/dao';
import { Adjudication, ParentComplaint, BadRecord, AuditLog } from '../types';
import { maskComplaint, maskAdjudication, maskBadRecord, maskAuditLogDetails, UserRole } from '../security/masking';

export interface ExportOptions {
  format: 'csv' | 'json';
  includeSensitive: boolean;
  userRole: 'admin' | 'dispatcher';
  dateRange?: { start: string; end: string };
}

function formatTime(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export async function exportAdjudications(options: ExportOptions, outputPath: string): Promise<number> {
  const adjudications = await dao.getAllAdjudications();

  let processedData = adjudications;
  if (!options.includeSensitive) {
    processedData = adjudications.map(a => maskAdjudication(a, options.userRole));
  }

  if (options.format === 'csv') {
    const csvContent = adjudicationsToCSV(processedData, options.includeSensitive, options.userRole);
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
  } else {
    fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2), 'utf-8');
  }

  await dao.insertAuditLog({
    entityType: 'export',
    entityId: 0,
    action: 'export_adjudications',
    details: JSON.stringify({
      format: options.format,
      includeSensitive: options.includeSensitive,
      outputPath,
      recordCount: processedData.length
    }),
    operator: 'cli',
    timestamp: formatTime(new Date())
  });

  return processedData.length;
}

export async function exportBadRecords(options: ExportOptions, outputPath: string): Promise<number> {
  const badRecords = await dao.getBadRecords();

  let processedData = badRecords;
  if (!options.includeSensitive) {
    processedData = badRecords.map(r => maskBadRecord(r, options.userRole));
  }

  if (options.format === 'csv') {
    const csvContent = badRecordsToCSV(processedData);
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
  } else {
    fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2), 'utf-8');
  }

  return processedData.length;
}

export async function exportAuditLogs(options: ExportOptions, outputPath: string): Promise<number> {
  const auditLogs = await dao.getAuditLogs();

  let processedData = auditLogs;
  if (!options.includeSensitive) {
    processedData = auditLogs.map(log => ({
      ...log,
      details: log.details ? maskAuditLogDetails(log.details, options.userRole) : log.details
    }));
  }

  if (options.format === 'csv') {
    const csvContent = auditLogsToCSV(processedData);
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
  } else {
    fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2), 'utf-8');
  }

  return processedData.length;
}

function adjudicationsToCSV(adjudications: Adjudication[], includeSensitive: boolean, userRole: UserRole): string {
  const headers = [
    'ID',
    '申诉ID',
    '裁定结果',
    '置信度',
    '裁定理由',
    '裁定人',
    '裁定时间',
    '复核状态',
    '复核人',
    '复核时间',
    '复核备注'
  ];

  const resultLabels: Record<string, string> = {
    driver_fault: '司机责任',
    traffic_fault: '交通原因',
    parent_fault: '家长原因',
    system_error: '系统错误',
    undetermined: '待复核'
  };

  const reviewLabels: Record<string, string> = {
    confirmed: '已确认',
    overturned: '已推翻',
    pending_review: '待复核'
  };

  const rows = adjudications.map(a => [
    a.id,
    a.complaintId,
    resultLabels[a.result] || a.result,
    `${(a.confidence * 100).toFixed(1)}%`,
    a.reasons.join('; '),
    a.adjudicator,
    a.adjudicatedAt,
    reviewLabels[a.reviewStatus] || a.reviewStatus,
    a.reviewedBy || '',
    a.reviewedAt || '',
    a.reviewNotes || ''
  ]);

  return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
}

function badRecordsToCSV(badRecords: BadRecord[]): string {
  const headers = [
    'ID',
    '来源类型',
    '原始数据',
    '行号',
    '失败原因',
    '修改建议',
    '创建时间'
  ];

  const sourceLabels: Record<string, string> = {
    schedule_csv: '站点时刻表CSV',
    gps_json: 'GPS JSON',
    complaint: '申诉单',
    checkin: '打卡记录'
  };

  const rows = badRecords.map(r => [
    r.id,
    sourceLabels[r.sourceType] || r.sourceType,
    r.rawData.substring(0, 100),
    r.rowNumber || '',
    r.failureReason,
    r.suggestedFix,
    r.createdAt || ''
  ]);

  return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
}

function auditLogsToCSV(auditLogs: any[]): string {
  const headers = [
    'ID',
    '实体类型',
    '实体ID',
    '操作',
    '操作人',
    '时间',
    '详情'
  ];

  const rows = auditLogs.map(log => [
    log.id,
    log.entityType,
    log.entityId,
    log.action,
    log.operator,
    log.timestamp,
    (log.details || '').substring(0, 200)
  ]);

  return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
}

export async function generateAdjudicationReport(adjudicationId: number, outputPath: string): Promise<void> {
  const adjudication = await dao.getAdjudicationByMatchId(adjudicationId);
  if (!adjudication) {
    throw new Error('裁定记录不存在');
  }

  const complaint = await dao.getComplaintById(adjudication.complaintId);
  const match = await dao.getMatchByComplaintId(adjudication.complaintId);

  const reportLines: string[] = [];
  reportLines.push('========================================');
  reportLines.push('         校车调度责任裁定报告           ');
  reportLines.push('========================================');
  reportLines.push('');

  reportLines.push('【申诉信息】');
  if (complaint) {
    reportLines.push(`申诉单号: ${complaint.complaintId}`);
    reportLines.push(`家长姓名: ${complaint.parentName}`);
    reportLines.push(`学生姓名: ${complaint.studentName}`);
    reportLines.push(`线路ID: ${complaint.routeId}`);
    reportLines.push(`站点ID: ${complaint.stopId}`);
    reportLines.push(`计划时间: ${complaint.scheduledDate} ${complaint.scheduledTime}`);
    reportLines.push(`申诉类型: ${complaint.complaintType}`);
    reportLines.push(`申诉描述: ${complaint.description}`);
  }
  reportLines.push('');

  reportLines.push('【匹配信息】');
  if (match) {
    reportLines.push(`匹配置信度: ${(match.matchConfidence * 100).toFixed(1)}%`);
    reportLines.push(`时间差异: ${match.timeDiscrepancyMinutes > 0 ? '晚' : '早'} ${Math.abs(match.timeDiscrepancyMinutes).toFixed(1)} 分钟`);
    reportLines.push(`距离差异: ${match.distanceDiscrepancyMeters.toFixed(1)} 米`);
    reportLines.push(`GPS记录数: ${match.gpsRecords.length}`);
    reportLines.push(`打卡记录数: ${match.checkinRecords.length}`);
  }
  reportLines.push('');

  reportLines.push('【裁定结果】');
  const resultLabels: Record<string, string> = {
    driver_fault: '司机责任',
    traffic_fault: '交通或路况原因',
    parent_fault: '家长原因',
    system_error: '系统错误',
    undetermined: '待人工复核'
  };
  reportLines.push(`裁定结果: ${resultLabels[adjudication.result] || adjudication.result}`);
  reportLines.push(`裁定置信度: ${(adjudication.confidence * 100).toFixed(1)}%`);
  reportLines.push(`裁定时间: ${adjudication.adjudicatedAt}`);
  reportLines.push(`裁定人: ${adjudication.adjudicator}`);
  reportLines.push('');

  reportLines.push('【裁定理由】');
  adjudication.reasons.forEach((reason, index) => {
    reportLines.push(`${index + 1}. ${reason}`);
  });
  reportLines.push('');

  if (adjudication.reviewStatus !== 'pending_review') {
    reportLines.push('【复核信息】');
    reportLines.push(`复核状态: ${adjudication.reviewStatus === 'confirmed' ? '已确认' : '已推翻'}`);
    reportLines.push(`复核人: ${adjudication.reviewedBy}`);
    if (adjudication.reviewNotes) {
      reportLines.push(`复核备注: ${adjudication.reviewNotes}`);
    }
    reportLines.push('');
  }

  reportLines.push('========================================');
  reportLines.push('报告生成时间: ' + formatTime(new Date()));
  reportLines.push('========================================');

  fs.writeFileSync(outputPath, reportLines.join('\n'), 'utf-8');
}
