import { AirspaceRecord, HistoryEntry, NoFlyZoneIssue, RouteVersion, RouteData } from '../types';
import { generateKML } from './kml';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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

export function exportRecordsToCSV(records: AirspaceRecord[]): string {
  const headers = ['ID', '来源', '状态', '电池循环', '飞手', '创建时间', '更新时间', '待处理原因'];
  const rows = records.map((r) => [
    r.id,
    r.source,
    getStatusLabel(r.status),
    r.batteryCycle,
    r.pilot,
    formatDate(r.createdAt),
    formatDate(r.updatedAt),
    r.pendingReason || '',
  ]);

  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}

export function exportToJSON(
  records: AirspaceRecord[],
  history: HistoryEntry[],
  issues: NoFlyZoneIssue[],
  routeVersions: RouteVersion[]
): string {
  return JSON.stringify(
    {
      exportTime: new Date().toISOString(),
      version: '1.0',
      records,
      history,
      issues,
      routeVersions,
    },
    null,
    2
  );
}

export function exportRouteToKML(routeData: RouteData, version?: number): string {
  const kml = generateKML(routeData);
  const filename = version ? `${routeData.name}_v${version}.kml` : `${routeData.name}.kml`;
  downloadFile(kml, filename, 'application/vnd.google-earth.kml+xml');
  return kml;
}

export function exportRecordWithHistory(
  record: AirspaceRecord,
  history: HistoryEntry[],
  routeVersions: RouteVersion[],
  issues: NoFlyZoneIssue[]
): string {
  const content = `
赛事空域协同 - 记录详情导出
=====================================
记录ID: ${record.id}
来源: ${record.source}
当前状态: ${getStatusLabel(record.status)}
电池循环: ${record.batteryCycle}
飞手: ${record.pilot}
创建时间: ${formatDate(record.createdAt)}
更新时间: ${formatDate(record.updatedAt)}
${record.pendingReason ? `待处理原因: ${record.pendingReason}` : ''}

航线版本历史
-------------------------------------
${routeVersions
  .sort((a, b) => a.version - b.version)
  .map((v) => `版本 ${v.version}: ${v.routeData.name} - ${formatDate(v.createdAt)} - ${v.createdBy}${v.changeDescription ? ` (${v.changeDescription})` : ''}`)
  .join('\n')}

禁飞区问题
-------------------------------------
${issues.length === 0 ? '无' : issues.map((i) => `[${getIssueStatusLabel(i.status)}] ${getSourceTypeLabel(i.sourceType)} - ${i.description} - 责任人: ${i.assignee}`).join('\n')}

操作历史
-------------------------------------
${history
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .map((h) => `${formatDate(h.timestamp)} - ${h.operator} - ${getActionLabel(h.action)}${h.reason ? ` (${h.reason})` : ''}`)
  .join('\n')}
  `.trim();

  downloadFile(content, `记录_${record.id}_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`, 'text/plain');
  return content;
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_review: '待复核',
    reviewed: '已复核',
    pending_processing: '待处理',
    resolved: '已解决',
  };
  return labels[status] || status;
}

export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: '创建记录',
    status_change: '状态变更',
    route_modify: '航线修改',
    issue_create: '创建问题',
    issue_resolve: '解决问题',
    note_add: '添加备注',
  };
  return labels[action] || action;
}

export function getSourceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pilot_note: '飞手备注',
    inspection_photo: '巡检照片',
  };
  return labels[type] || type;
}

export function getIssueStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: '待处理',
    in_progress: '处理中',
    resolved: '已解决',
  };
  return labels[status] || status;
}
