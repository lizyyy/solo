import * as fs from 'fs';
import * as path from 'path';
import {
  CallReport,
  QualityEvent,
  AlignedTimeline,
  WebrtcStat,
  SignalingEvent
} from './types';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${remainingMinutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

export function buildCallReport(
  qualityEvents: QualityEvent[],
  timeline: AlignedTimeline,
  stats: WebrtcStat[],
  signalingEvents: SignalingEvent[]
): CallReport {
  const doctorIds = Array.from(new Set([
    ...stats.filter(s => s.role === 'doctor').map(s => s.clientId),
    ...signalingEvents.filter(e => e.role === 'doctor').map(e => e.clientId)
  ]));
  const patientIds = Array.from(new Set([
    ...stats.filter(s => s.role === 'patient').map(s => s.clientId),
    ...signalingEvents.filter(e => e.role === 'patient').map(e => e.clientId)
  ]));

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  qualityEvents.forEach(event => {
    byCategory[event.category] = (byCategory[event.category] || 0) + 1;
    bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
  });

  return {
    callId: `call_${Date.now()}`,
    startTime: new Date(timeline.startTime),
    endTime: new Date(timeline.endTime),
    duration: timeline.duration,
    participants: {
      doctor: doctorIds,
      patient: patientIds
    },
    qualityEvents,
    summary: {
      totalEvents: qualityEvents.length,
      byCategory,
      bySeverity
    }
  };
}

export function exportMarkdown(report: CallReport, outputPath: string): void {
  let md = `# WebRTC 通话质量复盘报告

## 基本信息

- **通话 ID**: ${report.callId}
- **开始时间**: ${report.startTime.toLocaleString()}
- **结束时间**: ${report.endTime.toLocaleString()}
- **通话时长**: ${formatDuration(report.duration)}

## 参与者

- **医生**: ${report.participants.doctor.join(', ') || '无'}
- **患者**: ${report.participants.patient.join(', ') || '无'}

## 质量事件概览

- **总事件数**: ${report.summary.totalEvents}

### 按类别统计

`;

  for (const [category, count] of Object.entries(report.summary.byCategory)) {
    md += `- ${category}: ${count}\n`;
  }

  md += `
### 按严重程度统计

`;

  for (const [severity, count] of Object.entries(report.summary.bySeverity)) {
    md += `- ${severity}: ${count}\n`;
  }

  md += `
## 详细质量事件

| 时间 | 角色 | 客户端 | 规则 | 类别 | 严重程度 | 描述 |
|------|------|--------|------|------|----------|------|
`;

  report.qualityEvents.forEach(event => {
    md += `| ${new Date(event.timestamp).toLocaleString()} | ${event.role} | ${event.clientId} | ${event.ruleName} | ${event.category} | ${event.severity} | ${event.description} |\n`;
  });

  fs.writeFileSync(outputPath, md, 'utf-8');
}

export function exportCsv(events: QualityEvent[], outputPath: string): void {
  const headers = [
    'timestamp',
    'role',
    'clientId',
    'ruleId',
    'ruleName',
    'category',
    'severity',
    'description',
    'value',
    'threshold'
  ];

  const rows = events.map(event => [
    event.timestamp.toString(),
    event.role,
    event.clientId,
    event.ruleId,
    event.ruleName,
    event.category,
    event.severity,
    event.description,
    event.value?.toString() || '',
    event.threshold?.toString() || ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  fs.writeFileSync(outputPath, csv, 'utf-8');
}

export function exportHtml(
  report: CallReport,
  timeline: AlignedTimeline,
  outputPath: string
): void {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebRTC 通话时间线</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 20px; }
    .info { margin-bottom: 30px; padding: 15px; background: #f0f7ff; border-left: 4px solid #1890ff; border-radius: 4px; }
    .info p { margin: 5px 0; color: #666; }
    .timeline { position: relative; padding: 20px 0; }
    .timeline::before { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: 2px; height: 100%; background: #e0e0e0; }
    .timeline-item { position: relative; margin-bottom: 30px; width: 45%; }
    .timeline-item.left { left: 0; }
    .timeline-item.right { left: 55%; }
    .timeline-dot { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #1890ff; border: 3px solid white; box-shadow: 0 0 0 2px #1890ff; z-index: 1; }
    .timeline-item.left .timeline-dot { right: -32px; top: 5px; }
    .timeline-item.right .timeline-dot { left: -32px; top: 5px; }
    .timeline-content { background: white; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .timeline-time { font-size: 12px; color: #999; margin-bottom: 5px; }
    .timeline-role { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; margin-bottom: 8px; }
    .timeline-role.doctor { background: #e6f7ff; color: #1890ff; }
    .timeline-role.patient { background: #f6ffed; color: #52c41a; }
    .timeline-type { font-weight: 600; color: #333; margin-bottom: 5px; }
    .event-high { background: #fff1f0; border-left: 4px solid #ff4d4f; }
    .event-medium { background: #fffbe6; border-left: 4px solid #faad14; }
    .event-low { background: #f0f5ff; border-left: 4px solid #1890ff; }
    .events-summary { margin-top: 30px; }
    .events-summary h2 { margin-bottom: 15px; color: #333; }
    .event-item { padding: 12px; margin-bottom: 10px; border-radius: 4px; }
    .event-meta { font-size: 12px; color: #666; margin-bottom: 5px; }
    .event-desc { color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <h1>WebRTC 通话时间线</h1>

    <div class="info">
      <p><strong>通话 ID:</strong> ${report.callId}</p>
      <p><strong>开始时间:</strong> ${report.startTime.toLocaleString()}</p>
      <p><strong>结束时间:</strong> ${report.endTime.toLocaleString()}</p>
      <p><strong>通话时长:</strong> ${formatDuration(report.duration)}</p>
      <p><strong>医生:</strong> ${report.participants.doctor.join(', ') || '无'}</p>
      <p><strong>患者:</strong> ${report.participants.patient.join(', ') || '无'}</p>
    </div>

    <div class="timeline">
      ${timeline.events.slice(0, 50).map((event, index) => `
        <div class="timeline-item ${index % 2 === 0 ? 'left' : 'right'}">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-time">${new Date(event.timestamp).toLocaleString()}</div>
            <div class="timeline-role ${event.role}">${event.role === 'doctor' ? '医生' : '患者'}</div>
            <div class="timeline-type">${event.type}</div>
            <div style="font-size: 12px; color: #999;">${event.clientId}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="events-summary">
      <h2>质量事件 (${report.qualityEvents.length})</h2>
      ${report.qualityEvents.map(event => `
        <div class="event-item event-${event.severity}">
          <div class="event-meta">${new Date(event.timestamp).toLocaleString()} | ${event.role === 'doctor' ? '医生' : '患者'} | ${event.category} | ${event.severity}</div>
          <div class="event-desc"><strong>${event.ruleName}:</strong> ${event.description}</div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf-8');
}

export function exportAll(
  report: CallReport,
  timeline: AlignedTimeline,
  events: QualityEvent[],
  outputDir: string
): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  exportMarkdown(report, path.join(outputDir, 'call_report.md'));
  exportCsv(events, path.join(outputDir, 'quality_events.csv'));
  exportHtml(report, timeline, path.join(outputDir, 'timeline.html'));
}
