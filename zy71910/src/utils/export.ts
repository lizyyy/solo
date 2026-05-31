import { Segment, ExportManifest, OperationLog, ConfirmRecord } from '../types';
import { formatTime } from './messages';

export function generateExportId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EXP-${dateStr}-${random}`;
}

export function buildExportManifest(
  trackName: string,
  segments: Segment[],
  operations: OperationLog[],
  confirmRecords: ConfirmRecord[]
): ExportManifest {
  const confirmedSegments = segments.filter(s => s.status === 'confirmed');
  const pendingSegments = segments.filter(s => s.status === 'pending');
  
  const operationSummary = operations.slice(0, 10).map(op => 
    `[${new Date(op.timestamp).toLocaleString()}] ${op.actionType}`
  );
  
  const anomalyNotes = pendingSegments
    .filter(s => s.anomalyType !== 'normal')
    .map(s => `第 ${segments.indexOf(s) + 1} 段：${s.anomalyNote || s.anomalyType}`);

  return {
    exportId: generateExportId(),
    trackName,
    exportedAt: new Date(),
    segments: confirmedSegments,
    operationSummary,
    anomalyNotes
  };
}

export function exportAsJSON(manifest: ExportManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function exportAsCSV(segments: Segment[]): string {
  const header = '序号,开始时间,结束时间,时长,字幕内容,状态,异常标记';
  const rows = segments
    .filter(s => s.status === 'confirmed')
    .map((s, idx) => {
      const duration = (s.endTime - s.startTime).toFixed(2);
      const text = s.text.replace(/"/g, '""');
      return [
        idx + 1,
        formatTime(s.startTime),
        formatTime(s.endTime),
        duration,
        `"${text}"`,
        s.status,
        s.anomalyType
      ].join(',');
    });
  return [header, ...rows].join('\n');
}

export function exportAsMarkdown(manifest: ExportManifest): string {
  const lines = [
    `# ${manifest.trackName} - 上线清单`,
    '',
    `导出编号：${manifest.exportId}`,
    '',
    `导出时间：${manifest.exportedAt.toLocaleString()}`,
    '',
    `## 分段清单（共 ${manifest.segments.length} 段）`,
    '',
    '| 序号 | 时间 | 时长 | 内容 |',
    '|------|------|------|------|'
  ];

  manifest.segments.forEach((s, idx) => {
    const timeRange = `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`;
    const duration = (s.endTime - s.startTime).toFixed(2) + 's';
    lines.push(`| ${idx + 1} | ${timeRange} | ${duration} | ${s.text} |`);
  });

  if (manifest.anomalyNotes.length > 0) {
    lines.push('', '## 待确认项（未导出）', '');
    manifest.anomalyNotes.forEach(note => {
      lines.push(`- ⚠️ ${note}`);
    });
  }

  if (manifest.operationSummary.length > 0) {
    lines.push('', '## 操作摘要', '');
    manifest.operationSummary.forEach(op => {
      lines.push(`- ${op}`);
    });
  }

  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
