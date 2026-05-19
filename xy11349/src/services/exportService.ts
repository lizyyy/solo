import * as fs from 'fs';
import * as path from 'path';
import { db } from '../models/database';
import { UserContext } from '../models/types';

export interface ExportOptions {
  outputDir?: string;
  includeBadRecords?: boolean;
  includeAuditLogs?: boolean;
}

export interface ExportResult {
  qualityRecordsPath: string;
  reworkRecordsPath: string;
  badRecordsPath?: string;
  auditLogsPath?: string;
  totalRecords: number;
}

function formatDate(date: Date): string {
  return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
}

export function exportData(
  userContext: UserContext,
  options: ExportOptions = {}
): ExportResult {
  const outputDir = options.outputDir || path.join(process.cwd(), 'data', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

  const qualityRecords = db.qualityRecords.findAll();
  const qualityRecordsPath = path.join(outputDir, `quality-records-${timestamp}.csv`);
  
  let qualityCsv = '批次号,订单号,L值,a值,b值,纸张批次,操作人,角色,测量时间,创建时间\n';
  for (const record of qualityRecords) {
    qualityCsv += [
      record.batchId,
      record.orderId,
      record.labValues.L.toFixed(2),
      record.labValues.a.toFixed(2),
      record.labValues.b.toFixed(2),
      record.paperBatch,
      record.operator,
      record.role,
      formatDate(record.measuredAt),
      formatDate(record.createdAt),
    ].join(',') + '\n';
  }
  fs.writeFileSync(qualityRecordsPath, qualityCsv, 'utf8');

  const reworkRecords = db.reworkRecords.findAll();
  const reworkRecordsPath = path.join(outputDir, `rework-records-${timestamp}.csv`);
  
  let reworkCsv = '批次号,返工原因,解决方案,操作人,角色,返工时间,创建时间\n';
  for (const record of reworkRecords) {
    reworkCsv += [
      record.batchId,
      `"${record.reason.replace(/"/g, '""')}"`,
      `"${record.solution.replace(/"/g, '""')}"`,
      record.operator,
      record.role,
      formatDate(record.reworkedAt),
      formatDate(record.createdAt),
    ].join(',') + '\n';
  }
  fs.writeFileSync(reworkRecordsPath, reworkCsv, 'utf8');

  let badRecordsPath: string | undefined;
  if (options.includeBadRecords) {
    const badRecords = db.badRecords.findAll();
    badRecordsPath = path.join(outputDir, `bad-records-${timestamp}.csv`);
    
    let badCsv = '原始位置,失败原因,建议,是否已解决,解决人,解决时间,创建时间\n';
    for (const record of badRecords) {
      badCsv += [
        record.originalPosition,
        `"${record.failureReason.replace(/"/g, '""')}"`,
        `"${record.suggestions.join('; ').replace(/"/g, '""')}"`,
        record.isResolved ? '是' : '否',
        record.resolvedBy || '',
        record.resolvedAt ? formatDate(record.resolvedAt) : '',
        formatDate(record.createdAt),
      ].join(',') + '\n';
    }
    fs.writeFileSync(badRecordsPath, badCsv, 'utf8');
  }

  let auditLogsPath: string | undefined;
  if (options.includeAuditLogs) {
    const auditLogs = db.auditLogs.findAll();
    auditLogsPath = path.join(outputDir, `audit-logs-${timestamp}.csv`);
    
    let auditCsv = '操作,实体类型,实体ID,操作人,角色,时间,详情\n';
    for (const log of auditLogs) {
      auditCsv += [
        log.action,
        log.entityType,
        log.entityId || '',
        log.operator,
        log.role,
        formatDate(log.timestamp),
        `"${JSON.stringify(log.details).replace(/"/g, '""')}"`,
      ].join(',') + '\n';
    }
    fs.writeFileSync(auditLogsPath, auditCsv, 'utf8');
  }

  db.auditLogs.create({
    action: 'EXPORT',
    entityType: 'Data',
    operator: userContext.operator,
    role: userContext.role,
    details: {
      qualityRecordsCount: qualityRecords.length,
      reworkRecordsCount: reworkRecords.length,
      includeBadRecords: options.includeBadRecords,
      includeAuditLogs: options.includeAuditLogs,
    },
  });

  return {
    qualityRecordsPath,
    reworkRecordsPath,
    badRecordsPath,
    auditLogsPath,
    totalRecords: qualityRecords.length + reworkRecords.length,
  };
}
