import type { TimelineEvent } from '@/types/timeline';
import type { GateSession } from '@/types/gate';
import { formatTimestamp } from './time';
import { EVENT_TYPE_LABELS, EVENT_STATUS_LABELS, ABNORMAL_TYPE_LABELS } from '@/types/timeline';
import { JUDGMENT_RESULT_LABELS } from '@/types/gate';

export function exportToJSON(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function exportToCSV(events: TimelineEvent[], filename: string): void {
  const headers = ['时间', '类型', '标题', '状态', '操作人', '描述', '异常类型', '评分'];
  const rows = events.map(event => [
    formatTimestamp(event.timestamp),
    EVENT_TYPE_LABELS[event.type],
    event.title,
    EVENT_STATUS_LABELS[event.status],
    event.operator || '',
    event.description,
    event.abnormalMark ? ABNORMAL_TYPE_LABELS[event.abnormalMark.type] : '',
    event.scoreItem ? `${event.scoreItem.score}/${event.scoreItem.maxScore}` : ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}

export function exportTeachingReport(session: GateSession, events?: TimelineEvent[]): void {
  const htmlContent = generateTeachingReportHTML(session, events);
  const filename = `评估报告-${session.studentName}-${formatTimestamp(session.startTime, 'YYYY-MM-DD')}.html`;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, filename);
}

function generateTeachingReportHTML(session: GateSession, events?: TimelineEvent[]): string {
  const passRate = session.maxScore > 0 ? (session.totalScore / session.maxScore * 100).toFixed(1) : '0';
  const overallResult = session.totalScore >= session.maxScore * 0.6 ? '通过' : '未通过';

  const stepsHtml = session.steps.map(stepResult => {
    const judgment = stepResult.judgment;
    const scorePercent = judgment ? (judgment.score / judgment.maxScore * 100).toFixed(1) : '-';

    return `
      <div class="step-card" style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid ${getResultColor(judgment?.result || 'pending')}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; color: #1e293b;">
            步骤${stepResult.step.order}: ${stepResult.step.name}
          </h3>
          <span style="padding: 4px 12px; border-radius: 4px; background: ${getResultBgColor(judgment?.result || 'pending')}; color: ${getResultColor(judgment?.result || 'pending')}; font-weight: 500;">
            ${judgment ? `${judgment.score}/${judgment.maxScore}分 (${scorePercent}%)` : '未评分'}
          </span>
        </div>
        <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">${stepResult.step.description}</p>
        ${judgment ? `
          <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
            <div style="margin-bottom: 8px;">
              <strong style="color: #334155;">判断结果：</strong>
              <span style="color: ${getResultColor(judgment.result)}; font-weight: 500;">${JUDGMENT_RESULT_LABELS[judgment.result]}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: #334155;">原因分析：</strong>
              <span style="color: #475569;">${judgment.teachingReason}</span>
            </div>
            <div>
              <strong style="color: #334155;">下一步建议：</strong>
              <span style="color: #475569;">${judgment.nextStep}</span>
            </div>
          </div>
        ` : ''}
        ${stepResult.events.length > 0 ? `
          <div style="font-size: 12px; color: #94a3b8;">
            关联证据：${stepResult.events.length}条记录
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>水利闸门操作评估报告 - ${session.studentName}</title>
  <style>
    body {
      font-family: "Source Han Sans CN", "Noto Sans SC", system-ui, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f1f5f9;
      color: #1e293b;
    }
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #243b53 100%);
      color: white;
      padding: 32px;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0 0 16px 0;
      font-size: 28px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .info-item {
      background: white;
      padding: 16px;
      border-radius: 8px;
    }
    .info-label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
    }
    .overall-result {
      text-align: center;
      padding: 24px;
      background: white;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .overall-score {
      font-size: 48px;
      font-weight: 700;
      color: #1e3a5f;
    }
    .overall-label {
      font-size: 16px;
      color: #64748b;
      margin-top: 8px;
    }
    .overall-status {
      display: inline-block;
      margin-top: 16px;
      padding: 8px 24px;
      border-radius: 20px;
      font-size: 18px;
      font-weight: 600;
      background: ${overallResult === '通过' ? '#dcfce7' : '#fee2e2'};
      color: ${overallResult === '通过' ? '#166534' : '#991b1b'};
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      margin: 32px 0 16px 0;
      color: #1e293b;
    }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>水利闸门操作评估报告</h1>
    <div style="opacity: 0.8;">培训评估时间线工具生成</div>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">学员姓名</div>
      <div class="info-value">${session.studentName}</div>
    </div>
    <div class="info-item">
      <div class="info-label">考核时间</div>
      <div class="info-value">${formatTimestamp(session.startTime, 'YYYY-MM-DD')}</div>
    </div>
    <div class="info-item">
      <div class="info-label">总用时</div>
      <div class="info-value">${session.endTime ? formatDuration(session.endTime - session.startTime) : '未完成'}</div>
    </div>
  </div>

  <div class="overall-result">
    <div class="overall-score">${session.totalScore}<span style="font-size: 20px; color: #64748b;">/${session.maxScore}</span></div>
    <div class="overall-label">得分率 ${passRate}%</div>
    <div class="overall-status">${overallResult}</div>
  </div>

  <div class="summary">
    <strong style="color: #334155;">考核概况：</strong>
    本次考核共 ${session.steps.length} 个步骤，其中异常 ${session.abnormalCount} 项，待确认 ${session.pendingCount} 项。
    ${session.abnormalCount > 0 ? '<span style="color: #dc2626;">存在异常记录，建议人工复核。</span>' : ''}
  </div>

  <h2 class="section-title">各步骤详细评估</h2>
  ${stepsHtml}

  <div class="footer">
    <p>报告生成时间：${formatTimestamp(Date.now())}</p>
    <p>本报告由培训评估时间线工具自动生成，如有疑问请联系培训老师。</p>
  </div>
</body>
</html>
  `;
}

function getResultColor(result: string): string {
  switch (result) {
    case 'pass': return '#16a34a';
    case 'fail': return '#dc2626';
    case 'pending': return '#d97706';
    default: return '#64748b';
  }
}

function getResultBgColor(result: string): string {
  switch (result) {
    case 'pass': return '#dcfce7';
    case 'fail': return '#fee2e2';
    case 'pending': return '#fef3c7';
    default: return '#f1f5f9';
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
