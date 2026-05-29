import type {
  ExportReport,
  ExportFormat,
  ReportContent,
  FieldChange,
  AuditLog,
} from '@/types';
import { FIELD_LABELS } from '@/types';
import { formatDate } from './version';

export function exportToMarkdown(report: ExportReport): string {
  const { content } = report;
  const lines: string[] = [];

  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`**报告类型**: ${report.type === 'monthly' ? '月度复盘' : report.type === 'changes' ? '变更报告' : '自定义报告'}`);
  lines.push(`**时间范围**: ${formatDate(report.startDate)} 至 ${formatDate(report.endDate)}`);
  lines.push(`**生成时间**: ${formatDate(report.createdAt)}`);
  lines.push('');

  lines.push('## 📊 数据概览');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总镜头数 | ${content.summary.totalShots} |`);
  lines.push(`| 新增镜头 | ${content.summary.newShots} |`);
  lines.push(`| 总版本数 | ${content.summary.totalVersions} |`);
  lines.push(`| 编辑次数 | ${content.summary.edits} |`);
  lines.push(`| 回滚次数 | ${content.summary.rollbacks} |`);
  lines.push(`| 锁定次数 | ${content.summary.locks} |`);
  lines.push(`| 解锁次数 | ${content.summary.unlocks} |`);
  lines.push('');

  if (content.shotChanges.length > 0) {
    lines.push('## 📝 变更详情');
    lines.push('');

    for (const shotChange of content.shotChanges) {
      lines.push(`### 镜头 ${shotChange.shotNumber}`);
      lines.push('');
      lines.push(`**涉及版本**: ${shotChange.versions.join(', ')}`);
      lines.push('');
      lines.push('| 字段 | 旧值 | 新值 | 修改理由 | 修改时间 |');
      lines.push('|------|------|------|----------|----------|');

      for (const change of shotChange.changes) {
        lines.push(
          `| ${FIELD_LABELS[change.fieldName] || change.fieldName} | ${escapeMarkdown(change.oldValue)} | ${escapeMarkdown(change.newValue)} | ${escapeMarkdown(change.reason)} | ${formatDate(change.modifiedAt)} |`
        );
      }
      lines.push('');
    }
  }

  if (content.rollbackDetails.length > 0) {
    lines.push('## ⏪ 回滚记录');
    lines.push('');
    lines.push('| 镜头 | 从版本 | 到版本 | 回滚理由 | 时间 |');
    lines.push('|------|--------|--------|----------|------|');

    for (const rollback of content.rollbackDetails) {
      lines.push(
        `| ${rollback.shotNumber} | ${rollback.fromVersion} | ${rollback.toVersion} | ${escapeMarkdown(rollback.reason)} | ${formatDate(rollback.timestamp)} |`
      );
    }
    lines.push('');
  }

  if (content.auditTrail.length > 0) {
    lines.push('## 📜 审计轨迹');
    lines.push('');
    lines.push('| 时间 | 操作 | 镜头 | 详情 | 理由 |');
    lines.push('|------|------|------|------|------|');

    for (const log of content.auditTrail.slice(0, 50)) {
      const actionLabel = getActionLabel(log.action);
      lines.push(
        `| ${formatDate(log.timestamp)} | ${actionLabel} | ${log.shotId} | ${escapeMarkdown(JSON.stringify(log.details))} | ${escapeMarkdown(log.reason)} |`
      );
    }

    if (content.auditTrail.length > 50) {
      lines.push('');
      lines.push(`> 仅显示前50条记录，共${content.auditTrail.length}条`);
    }
  }

  return lines.join('\n');
}

export function exportToCSV(report: ExportReport): string {
  const { content } = report;
  const rows: string[][] = [];

  rows.push([
    '报告标题',
    report.title,
    '报告类型',
    report.type,
    '开始时间',
    formatDate(report.startDate),
    '结束时间',
    formatDate(report.endDate),
  ]);
  rows.push([]);

  rows.push(['=== 数据概览 ===']);
  rows.push(['总镜头数', content.summary.totalShots.toString()]);
  rows.push(['新增镜头', content.summary.newShots.toString()]);
  rows.push(['总版本数', content.summary.totalVersions.toString()]);
  rows.push(['编辑次数', content.summary.edits.toString()]);
  rows.push(['回滚次数', content.summary.rollbacks.toString()]);
  rows.push(['锁定次数', content.summary.locks.toString()]);
  rows.push(['解锁次数', content.summary.unlocks.toString()]);
  rows.push([]);

  rows.push(['=== 变更详情 ===']);
  rows.push(['镜头号', '字段', '旧值', '新值', '修改理由', '修改时间']);

  for (const shotChange of content.shotChanges) {
    for (const change of shotChange.changes) {
      rows.push([
        shotChange.shotNumber,
        FIELD_LABELS[change.fieldName] || change.fieldName,
        escapeCSV(change.oldValue),
        escapeCSV(change.newValue),
        escapeCSV(change.reason),
        formatDate(change.modifiedAt),
      ]);
    }
  }
  rows.push([]);

  rows.push(['=== 回滚记录 ===']);
  rows.push(['镜头号', '从版本', '到版本', '回滚理由', '时间']);

  for (const rollback of content.rollbackDetails) {
    rows.push([
      rollback.shotNumber,
      rollback.fromVersion,
      rollback.toVersion,
      escapeCSV(rollback.reason),
      formatDate(rollback.timestamp),
    ]);
  }

  return rows.map((row) => row.join(',')).join('\n');
}

export function exportToJSON(report: ExportReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportReport(report: ExportReport, format: ExportFormat): string {
  switch (format) {
    case 'markdown':
      return exportToMarkdown(report);
    case 'csv':
      return exportToCSV(report);
    case 'json':
      return exportToJSON(report);
    default:
      return exportToJSON(report);
  }
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

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function escapeCSV(text: string): string {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: '创建',
    edit: '编辑',
    lock: '锁定',
    unlock: '解锁',
    rollback: '回滚',
    export: '导出',
  };
  return labels[action] || action;
}

export function buildReportContent(
  startDate: string,
  endDate: string,
  shots: any[],
  auditLogs: AuditLog[],
  filters?: Record<string, any>
): ReportContent {
  const filteredAuditLogs = auditLogs.filter(
    (log) => log.timestamp >= startDate && log.timestamp <= endDate
  );

  const editedShots = new Set<string>();
  const shotChanges: ReportContent['shotChanges'] = [];
  const rollbackDetails: ReportContent['rollbackDetails'] = [];

  for (const shot of shots) {
    const relevantVersions = shot.versions.filter(
      (v: any) => v.createdAt >= startDate && v.createdAt <= endDate
    );

    if (relevantVersions.length > 0) {
      const allChanges: FieldChange[] = [];
      const versionNumbers: string[] = [];

      for (const version of relevantVersions) {
        versionNumbers.push(version.version);
        allChanges.push(...version.fieldChanges);

        if (version.rollbackFromVersionId) {
          const fromVersion = shot.versions.find(
            (v: any) => v.id === version.rollbackFromVersionId
          );
          rollbackDetails.push({
            shotId: shot.id,
            shotNumber: shot.shotNumber,
            fromVersion: fromVersion?.version || 'unknown',
            toVersion: version.version,
            reason: version.rollbackReason || '',
            timestamp: version.createdAt,
          });
        }
      }

      if (allChanges.length > 0) {
        shotChanges.push({
          shotId: shot.id,
          shotNumber: shot.shotNumber,
          changes: allChanges,
          versions: versionNumbers,
        });
      }
    }

    if (relevantVersions.length > 0) {
      editedShots.add(shot.id);
    }
  }

  const monthShots = shots.filter(
    (shot) => shot.createdAt >= startDate && shot.createdAt <= endDate
  );

  return {
    summary: {
      totalShots: shots.length,
      newShots: monthShots.length,
      totalVersions: shots.reduce((sum, s) => sum + s.versions.length, 0),
      edits: filteredAuditLogs.filter((l) => l.action === 'edit').length,
      rollbacks: filteredAuditLogs.filter((l) => l.action === 'rollback').length,
      locks: filteredAuditLogs.filter((l) => l.action === 'lock').length,
      unlocks: filteredAuditLogs.filter((l) => l.action === 'unlock').length,
    },
    shotChanges,
    rollbackDetails,
    auditTrail: filteredAuditLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  };
}
