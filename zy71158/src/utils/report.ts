import { GameReport, HistoryFrame, Stall, GameEvent, ScoreBreakdown, FailureReason } from '@/types/game';

export function generateReport(params: {
  levelId: number;
  levelName: string;
  totalRounds: number;
  scoreBreakdown: ScoreBreakdown;
  events: GameEvent[];
  stalls: Stall[];
  history: HistoryFrame[];
  failureReason: FailureReason | null;
}): GameReport {
  const { levelId, levelName, totalRounds, scoreBreakdown, events, stalls, history, failureReason } = params;

  const totalPenalties = events.filter((e) => e.type === 'penalty').length;
  const totalWarnings = events.filter((e) => e.type === 'warning').length;
  const totalRewards = events.filter((e) => e.type === 'reward').length;

  const stallPerformance = stalls.map((stall) => {
    const stallHistory = history.map((h) => h.snapshot.stalls.find((s) => s.id === stall.id)).filter(Boolean);
    const avgPower = stallHistory.length > 0
      ? stallHistory.reduce((sum, s) => sum + (s?.power || 0), 0) / stallHistory.length
      : stall.power;

    const violations = events.filter((e) => e.message.includes(stall.name)).length;

    return {
      name: stall.name,
      avgPower: Math.round(avgPower),
      totalSmoke: Math.round(stallHistory.reduce((sum, s) => sum + (s?.power || 0) * 0.5, 0)),
      violations,
    };
  });

  return {
    levelId,
    levelName,
    totalRounds,
    finalScore: scoreBreakdown.total,
    scoreBreakdown,
    totalPenalties,
    totalWarnings,
    totalRewards,
    failureReason,
    stallPerformance,
    history,
    timestamp: Date.now(),
  };
}

export function exportReportToJSON(report: GameReport): string {
  return JSON.stringify(report, null, 2);
}

export function downloadReport(report: GameReport): void {
  const json = exportReportToJSON(report);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `夜市经营报告_${report.levelName}_${new Date(report.timestamp).toLocaleDateString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatReportSummary(report: GameReport): string {
  const lines: string[] = [];
  lines.push(`=== 夜市摊位经营报告 ===`);
  lines.push(`关卡：${report.levelName}`);
  lines.push(`总回合：${report.totalRounds}`);
  lines.push(`最终评分：${report.finalScore} 分`);
  lines.push(`  用电效率：${report.scoreBreakdown.efficiency}/30`);
  lines.push(`  合规经营：${report.scoreBreakdown.compliance}/50`);
  lines.push(`  经营收益：${report.scoreBreakdown.profit}/20`);
  lines.push(`  违规扣分：-${report.scoreBreakdown.penalty}`);
  lines.push(`处罚事件：${report.totalPenalties} 次`);
  lines.push(`警告事件：${report.totalWarnings} 次`);
  lines.push(`奖励事件：${report.totalRewards} 次`);

  if (report.failureReason) {
    lines.push(`失败原因：${report.failureReason.message}`);
    lines.push(`详情：${report.failureReason.detail}`);
  }

  lines.push(`\n各摊位表现：`);
  report.stallPerformance.forEach((p) => {
    lines.push(`  ${p.name}：平均功率 ${p.avgPower}%，违规 ${p.violations} 次`);
  });

  return lines.join('\n');
}