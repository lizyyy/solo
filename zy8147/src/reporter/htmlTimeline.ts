import { AnalysisResult, Issue, WeighingEvent, IssueType } from '../types';

const severityColors: Record<string, string> = {
  low: '#f0f0f0',
  medium: '#fff3cd',
  high: '#f8d7da',
  critical: '#dc3545',
};

const severityBorderColors: Record<string, string> = {
  low: '#d0d0d0',
  medium: '#ffc107',
  high: '#dc3545',
  critical: '#721c24',
};

const issueTypeColors: Record<IssueType, string> = {
  calibration_expired: '#dc3545',
  weight_jump: '#fd7e14',
  duplicate_frame: '#6c757d',
  midnight_batch_misalignment: '#6f42c1',
  bad_frame: '#dc3545',
  weight_out_of_tolerance: '#fd7e14',
  unstable_reading: '#ffc107',
  missing_data: '#17a2b8',
};

export function generateHtmlTimeline(result: AnalysisResult): string {
  const { summary, issues, weighingEvents, stationStates } = result;
  const stations = summary.stationsAnalyzed;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>称重日志分析 - 时间线</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f8f9fa;
      color: #333;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #2c3e50; margin-bottom: 20px; font-size: 24px; }
    .summary-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .summary-item {
      text-align: center;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .summary-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
    .summary-label { font-size: 12px; color: #6c757d; margin-top: 5px; }
    
    .timeline-container {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .timeline-title { font-size: 18px; font-weight: 600; color: #2c3e50; }
    
    .station-section {
      margin-bottom: 30px;
      border: 1px solid #e9ecef;
      border-radius: 6px;
      overflow: hidden;
    }
    .station-header {
      background: #2c3e50;
      color: white;
      padding: 12px 15px;
      font-weight: 600;
    }
    .station-content { padding: 15px; }
    
    .timeline-events {
      position: relative;
      padding-left: 40px;
    }
    .timeline-events::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #dee2e6;
    }
    
    .event-item {
      position: relative;
      margin-bottom: 20px;
      padding: 12px 15px;
      border-radius: 6px;
      border-left: 4px solid #28a745;
      background: #f8fff9;
    }
    .event-item::before {
      content: '';
      position: absolute;
      left: -32px;
      top: 16px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #28a745;
      border: 2px solid white;
      box-shadow: 0 0 0 2px #28a745;
    }
    .event-item.warning {
      border-left-color: #ffc107;
      background: #fffbe6;
    }
    .event-item.warning::before {
      background: #ffc107;
      box-shadow: 0 0 0 2px #ffc107;
    }
    .event-item.error {
      border-left-color: #dc3545;
      background: #fff5f5;
    }
    .event-item.error::before {
      background: #dc3545;
      box-shadow: 0 0 0 2px #dc3545;
    }
    
    .event-time {
      font-size: 11px;
      color: #6c757d;
      margin-bottom: 5px;
    }
    .event-title {
      font-weight: 600;
      margin-bottom: 5px;
    }
    .event-details {
      font-size: 13px;
      color: #6c757d;
    }
    
    .issues-section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .issue-item {
      padding: 12px 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid;
    }
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .issue-type {
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .issue-type-badge {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .issue-time { font-size: 12px; color: #6c757d; }
    .issue-desc { font-size: 13px; color: #495057; }
    .issue-station {
      display: inline-block;
      padding: 2px 8px;
      background: #e9ecef;
      border-radius: 4px;
      font-size: 11px;
      margin-top: 8px;
    }
    
    .legend {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      margin-top: 20px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .footer {
      text-align: center;
      padding: 20px;
      color: #6c757d;
      font-size: 12px;
    }
    .tab-buttons {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .tab-button {
      padding: 10px 20px;
      border: 1px solid #dee2e6;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    .tab-button.active {
      background: #2c3e50;
      color: white;
      border-color: #2c3e50;
    }
    .tab-button:hover:not(.active) {
      background: #f8f9fa;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>称重日志分析 - 时间线</h1>
    
    <div class="summary-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600;">分析摘要</span>
        <span style="font-size: 12px; color: #6c757d;">生成时间: ${summary.analysisTime.toLocaleString('zh-CN')}</span>
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${summary.totalFrames}</div>
          <div class="summary-label">总帧数</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: #28a745;">${summary.validFrames}</div>
          <div class="summary-label">有效帧</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: ${summary.invalidFrames > 0 ? '#dc3545' : '#6c757d'};">${summary.invalidFrames}</div>
          <div class="summary-label">无效帧</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${summary.weighingEvents}</div>
          <div class="summary-label">称重事件</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: ${summary.totalIssues > 0 ? '#dc3545' : '#28a745'};">${summary.totalIssues}</div>
          <div class="summary-label">问题总数</div>
        </div>
      </div>
    </div>

    <div class="tab-buttons">
      <button class="tab-button active" onclick="showTab('timeline')">时间线</button>
      <button class="tab-button" onclick="showTab('issues')">问题列表</button>
      <button class="tab-button" onclick="showTab('stations')">工位状态</button>
    </div>

    <div id="tab-timeline" class="tab-content active">
      ${generateTimelineContent(stations, weighingEvents, issues)}
    </div>

    <div id="tab-issues" class="tab-content">
      ${generateIssuesContent(issues)}
    </div>

    <div id="tab-stations" class="tab-content">
      ${generateStationsContent(stationStates, stations)}
    </div>

    <div class="legend">
      <div class="legend-item"><span class="legend-dot" style="background: #28a745;"></span>正常称重</div>
      <div class="legend-item"><span class="legend-dot" style="background: #ffc107;"></span>警告</div>
      <div class="legend-item"><span class="legend-dot" style="background: #dc3545;"></span>错误</div>
      <div class="legend-item"><span class="legend-dot" style="background: #6f42c1;"></span>批次错位</div>
    </div>

    <div class="footer">
      由称重日志分析工具生成 | 共 ${stations.length} 个工位 | ${weighingEvents.length} 个称重事件
    </div>
  </div>

  <script>
    function showTab(tabName) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + tabName).classList.add('active');
      event?.target.classList.add('active');
    }
  </script>
</body>
</html>`;
}

function generateTimelineContent(
  stations: string[],
  events: WeighingEvent[],
  issues: Issue[]
): string {
  if (events.length === 0 && issues.length === 0) {
    return `<div class="timeline-container">
      <div class="timeline-header">
        <span class="timeline-title">暂无数据</span>
      </div>
      <p style="color: #6c757d; padding: 20px;">未检测到称重事件或问题。</p>
    </div>`;
  }

  const eventsByStation = groupByStation(events);
  const issuesByStation = groupByStationIssues(issues);

  let html = '';

  for (const stationId of stations) {
    const stationEvents = eventsByStation[stationId] || [];
    const stationIssues = issuesByStation[stationId] || [];
    
    const eventItems = stationEvents.map(e => ({
      type: 'event' as const,
      time: e.startTime,
      eventData: e,
      issueData: null as Issue | null,
    }));
    
    const issueItems = stationIssues.map(i => ({
      type: 'issue' as const,
      time: i.timestamp,
      eventData: null as WeighingEvent | null,
      issueData: i,
    }));
    
    const allItems = [...eventItems, ...issueItems].sort(
      (a, b) => a.time.getTime() - b.time.getTime()
    );

    html += `
    <div class="station-section">
      <div class="station-header">工位 ${stationId}</div>
      <div class="station-content">
        <div class="timeline-events">
          ${allItems.length > 0 ? allItems.map(item => {
            if (item.type === 'event' && item.eventData) {
              return renderEvent(item.eventData);
            } else if (item.type === 'issue' && item.issueData) {
              return renderIssueItem(item.issueData);
            }
            return '';
          }).filter(Boolean).join('') : '<p style="color: #6c757d;">此工位暂无数据</p>'}
        </div>
      </div>
    </div>`;
  }

  return `<div class="timeline-container">
    <div class="timeline-header">
      <span class="timeline-title">时间线视图</span>
    </div>
    ${html}
  </div>`;
}

function groupByStation(events: WeighingEvent[]): Record<string, WeighingEvent[]> {
  return events.reduce((acc, event) => {
    if (!acc[event.stationId]) {
      acc[event.stationId] = [];
    }
    acc[event.stationId].push(event);
    return acc;
  }, {} as Record<string, WeighingEvent[]>);
}

function groupByStationIssues(issues: Issue[]): Record<string, Issue[]> {
  return issues.reduce((acc, issue) => {
    if (!acc[issue.stationId]) {
      acc[issue.stationId] = [];
    }
    acc[issue.stationId].push(issue);
    return acc;
  }, {} as Record<string, Issue[]>);
}

function renderEvent(event: WeighingEvent): string {
  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  const durationSec = (durationMs / 1000).toFixed(2);
  
  return `
  <div class="event-item">
    <div class="event-time">${event.startTime.toLocaleString('zh-CN')} → ${event.endTime.toLocaleTimeString('zh-CN')}</div>
    <div class="event-title">称重事件 ${event.batchId ? `(批次: ${event.batchId})` : ''}</div>
    <div class="event-details">
      毛重: ${event.stableWeight} ${event.unit} | 
      净重: ${event.netWeight} ${event.unit} | 
      耗时: ${durationSec}s | 
      帧数: ${event.frames.length}
    </div>
  </div>`;
}

function renderIssueItem(issue: Issue): string {
  const issueTypeNames: Record<IssueType, string> = {
    calibration_expired: '校准过期',
    weight_jump: '重量跳变',
    duplicate_frame: '重复帧',
    midnight_batch_misalignment: '跨午夜批次错位',
    bad_frame: '坏帧',
    weight_out_of_tolerance: '重量超差',
    unstable_reading: '不稳定读数',
    missing_data: '数据缺失',
  };

  const className = issue.severity === 'critical' || issue.severity === 'high' ? 'error' : 
                    issue.severity === 'medium' ? 'warning' : '';
  const color = issueTypeColors[issue.type] || '#6c757d';

  return `
  <div class="event-item ${className}">
    <div class="event-time">${issue.timestamp.toLocaleString('zh-CN')}</div>
    <div class="event-title" style="color: ${color};">
      ${issueTypeNames[issue.type] || issue.type}
      <span style="font-size: 11px; margin-left: 8px; opacity: 0.7;">[${getSeverityLabel(issue.severity)}]</span>
    </div>
    <div class="event-details">${issue.description}</div>
  </div>`;
}

function generateIssuesContent(issues: Issue[]): string {
  if (issues.length === 0) {
    return `<div class="issues-section">
      <h3 style="margin-bottom: 15px; color: #2c3e50;">问题列表</h3>
      <p style="color: #28a745;">所有数据检查通过，未发现任何问题！</p>
    </div>`;
  }

  const sortedIssues = [...issues].sort((a, b) => {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
  });

  return `<div class="issues-section">
    <h3 style="margin-bottom: 15px; color: #2c3e50;">问题列表 (${issues.length} 个)</h3>
    ${sortedIssues.map(issue => {
      const bgColor = severityColors[issue.severity] || '#f0f0f0';
      const borderColor = severityBorderColors[issue.severity] || '#d0d0d0';
      const typeColor = issueTypeColors[issue.type] || '#6c757d';
      const issueTypeNames: Record<IssueType, string> = {
        calibration_expired: '校准过期',
        weight_jump: '重量跳变',
        duplicate_frame: '重复帧',
        midnight_batch_misalignment: '跨午夜批次错位',
        bad_frame: '坏帧',
        weight_out_of_tolerance: '重量超差',
        unstable_reading: '不稳定读数',
        missing_data: '数据缺失',
      };

      return `
      <div class="issue-item" style="background: ${bgColor}; border-left-color: ${borderColor};">
        <div class="issue-header">
          <span class="issue-type">
            <span class="issue-type-badge" style="background: ${typeColor};"></span>
            ${issueTypeNames[issue.type] || issue.type}
          </span>
          <span class="issue-time">${issue.timestamp.toLocaleString('zh-CN')}</span>
        </div>
        <div class="issue-desc">${issue.description}</div>
        <span class="issue-station">工位: ${issue.stationId}</span>
        <span class="issue-station" style="margin-left: 8px;">优先级: ${getSeverityLabel(issue.severity)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function generateStationsContent(
  stationStates: Record<string, { stationId: string; currentWeight: number; stableWeight: number | null; tare: number; unit: string; lastStableTime: Date | null; frames: unknown[]; consecutiveStable: number }>,
  stations: string[]
): string {
  return `<div class="timeline-container">
    <h3 style="margin-bottom: 20px; color: #2c3e50;">工位状态</h3>
    ${stations.map(stationId => {
      const state = stationStates[stationId];
      if (!state) return '';

      return `
      <div class="station-section">
        <div class="station-header">工位 ${stationId}</div>
        <div class="station-content">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">${state.unit.toUpperCase()}</div>
              <div class="summary-label">单位</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${state.tare}</div>
              <div class="summary-label">皮重 (${state.unit})</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${state.frames.length}</div>
              <div class="summary-label">总帧数</div>
            </div>
            <div class="summary-item">
              <div class="summary-value" style="color: ${state.stableWeight !== null ? '#28a745' : '#6c757d'};">
                ${state.stableWeight !== null ? state.stableWeight : '-'}
              </div>
              <div class="summary-label">最后稳定重量 (${state.unit})</div>
            </div>
          </div>
          ${state.lastStableTime ? `<p style="margin-top: 15px; font-size: 12px; color: #6c757d;">
            最后稳定时间: ${state.lastStableTime.toLocaleString('zh-CN')}
          </p>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
  };
  return labels[severity] || severity;
}
