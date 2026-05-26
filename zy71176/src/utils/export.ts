import type { SettlementReport } from '../game/types';

export function exportReportToJSON(report: SettlementReport): void {
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `hotel-report-${report.levelId}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportToText(report: SettlementReport): void {
  const text = generateTextReport(report);
  const dataBlob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `hotel-report-${report.levelId}-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function generateTextReport(report: SettlementReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('           酒店客房调度游戏 - 结算报告');
  lines.push('='.repeat(60));
  lines.push('');

  lines.push(`关卡: ${report.levelName} (ID: ${report.levelId})`);
  lines.push(`游戏时长: ${report.playTime} 分钟`);
  lines.push(`最终结果: ${report.won ? '🎉 胜利!' : '💔 失败'}`);
  lines.push('');

  if (report.failReason) {
    lines.push(`失败原因: ${report.failReason}`);
    lines.push('');
  }

  lines.push('-'.repeat(60));
  lines.push('核心指标');
  lines.push('-'.repeat(60));
  lines.push(`最终分数: ${report.finalScore} 分`);
  lines.push(`客人满意度: ${report.finalSatisfaction}%`);
  lines.push(`客诉次数: ${report.totalComplaints} 次`);
  lines.push(`服务客人: ${report.guestsServed} 位`);
  lines.push(`清洁房间: ${report.roomsCleaned} 间`);
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('关键事件时间线');
  lines.push('-'.repeat(60));

  report.keyEvents.forEach((event) => {
    const hours = Math.floor(event.time / 60) + 8;
    const mins = event.time % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    lines.push(`[${timeStr}] ${event.message}`);
  });

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('报告生成时间: ' + new Date().toLocaleString('zh-CN'));
  lines.push('='.repeat(60));

  return lines.join('\n');
}
