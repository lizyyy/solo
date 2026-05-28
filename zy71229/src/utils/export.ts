import { GameState, Decision, DataSource, DATA_SOURCE_LABELS, ANOMALY_TYPE_LABELS, ANOMALY_STATUS_LABELS } from '../game/types';
import { formatGameTime, formatVirtualTime } from '../game/engine';

export function exportToJSON(state: GameState): string {
  const exportData = {
    gameId: state.id,
    startTime: new Date(state.startTime).toISOString(),
    endTime: state.endTime ? new Date(state.endTime).toISOString() : null,
    totalScore: state.totalScore,
    scoreBreakdown: state.score,
    decisions: state.decisions.map(d => ({
      ...d,
      timestamp: formatGameTime(d.timestamp),
      virtualTime: formatVirtualTime(d.timestamp),
      anomalyType: ANOMALY_TYPE_LABELS[state.anomalies.find(a => a.id === d.anomalyId)?.type || 'missed_corner'],
      choice: ANOMALY_STATUS_LABELS[d.choice],
      evidenceUsed: d.evidenceUsed.map(s => DATA_SOURCE_LABELS[s]),
    })),
    anomalies: state.anomalies.map(a => ({
      ...a,
      triggerTimeFormatted: formatGameTime(a.triggerTime),
      typeLabel: ANOMALY_TYPE_LABELS[a.type],
      sourceLabel: DATA_SOURCE_LABELS[a.source],
      statusLabel: ANOMALY_STATUS_LABELS[a.status],
      correctActionLabel: ANOMALY_STATUS_LABELS[a.correctAction],
      playerChoiceLabel: a.playerChoice ? ANOMALY_STATUS_LABELS[a.playerChoice] : null,
    })),
    patrolCoverage: {
      totalCorners: state.corners.length,
      patrolledCorners: state.corners.filter(c => c.isPatrolled).length,
      totalHalls: state.halls.length,
      patrolledHalls: state.halls.filter(h => h.isPatrolled).length,
    },
    dataSourceUsage: Object.entries(state.viewedDataSources).map(([source, timestamps]) => ({
      source,
      sourceLabel: DATA_SOURCE_LABELS[source as DataSource],
      viewCount: timestamps.length,
      lastViewed: timestamps.length > 0 ? formatGameTime(timestamps[timestamps.length - 1]) : null,
    })),
    reportDraft: state.reportDraft,
  };

  return JSON.stringify(exportData, null, 2);
}

export function exportToCSV(state: GameState): string {
  const headers = [
    '决策时间(游戏)',
    '决策时间(虚拟)',
    '异常类型',
    '异常描述',
    '玩家选择',
    '正确动作',
    '是否正确',
    '决策耗时(秒)',
    '查看的数据源',
    '数据来源',
  ];

  const rows = state.decisions.map(d => {
    const anomaly = state.anomalies.find(a => a.id === d.anomalyId);
    return [
      formatGameTime(d.timestamp),
      formatVirtualTime(d.timestamp),
      anomaly ? ANOMALY_TYPE_LABELS[anomaly.type] : '',
      anomaly?.description || '',
      ANOMALY_STATUS_LABELS[d.choice],
      anomaly ? ANOMALY_STATUS_LABELS[anomaly.correctAction] : '',
      d.isCorrect ? '是' : '否',
      d.timeSpent.toString(),
      d.evidenceUsed.map(s => DATA_SOURCE_LABELS[s]).join('; '),
      anomaly ? DATA_SOURCE_LABELS[anomaly.source] : '',
    ].map(cell => `"${cell}"`).join(',');
  });

  const summaryRows = [
    [],
    ['=== 评分汇总 ==='],
    ['总分', state.totalScore.toString()],
    ...state.score.map(s => [s.category, `${s.points}/${s.maxPoints}`, s.description]),
    [],
    ['=== 巡逻覆盖 ==='],
    ['已巡展厅', `${state.halls.filter(h => h.isPatrolled).length}/${state.halls.length}`],
    ['已巡角落', `${state.corners.filter(c => c.isPatrolled).length}/${state.corners.length}`],
  ].map(row => row.map(cell => `"${cell}"`).join(','));

  return [headers.join(','), ...rows, ...summaryRows].join('\n');
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

export function generateReportFilename(state: GameState, format: 'json' | 'csv'): string {
  const date = new Date(state.startTime);
  const dateStr = date.toISOString().slice(0, 10);
  const scoreStr = `score_${state.totalScore}`;
  return `museum_night_patrol_${dateStr}_${scoreStr}.${format}`;
}
