import type { IsolationReport, SettlementResult, Level } from '../engine/types';

export function formatReportAsText(report: IsolationReport, level: Level): string {
  const date = new Date(report.timestamp);
  const dateStr = date.toLocaleString('zh-CN');

  const lines: string[] = [];
  lines.push('═'.repeat(60));
  lines.push('        管网漏点隔离操作报告');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`报告编号: ${report.levelId}-${report.timestamp}`);
  lines.push(`生成时间: ${dateStr}`);
  lines.push(`关卡名称: ${report.levelName}`);
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('一、操作记录');
  lines.push('─'.repeat(60));
  lines.push('');

  if (report.operations.length === 0) {
    lines.push('  无操作记录');
  } else {
    report.operations.forEach((op, index) => {
      const stateStr = op.toState ? '开启' : '关闭';
      const timeStr = new Date(op.timestamp).toLocaleTimeString('zh-CN');
      lines.push(`  ${index + 1}. [${timeStr}] 阀门 ${op.valveId} ${stateStr}`);
    });
  }

  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('二、隔离结果');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push(`  已隔离漏点: ${report.isolatedLeaks.length} / ${level.targetIsolatedLeaks}`);
  lines.push(`  受影响用户区: ${report.affectedUserAreas.length} 个`);
  lines.push(`  关闭阀门数: ${report.closedValves.length} 个`);
  lines.push(`  操作步数: ${report.operations.length} 步`);
  lines.push('');

  if (report.isolatedLeaks.length > 0) {
    lines.push('  已隔离漏点:');
    report.isolatedLeaks.forEach((leakId) => {
      lines.push(`    - ${leakId}`);
    });
    lines.push('');
  }

  if (report.affectedUserAreas.length > 0) {
    lines.push('  受影响用户区:');
    report.affectedUserAreas.forEach((areaId) => {
      lines.push(`    - ${areaId}`);
    });
    lines.push('');
  }

  if (report.closedValves.length > 0) {
    lines.push('  已关闭阀门:');
    report.closedValves.forEach((valveId) => {
      lines.push(`    - ${valveId}`);
    });
    lines.push('');
  }

  lines.push('─'.repeat(60));
  lines.push('三、评估建议');
  lines.push('─'.repeat(60));
  lines.push('');

  report.recommendations.forEach((rec, index) => {
    lines.push(`  ${index + 1}. ${rec}`);
  });

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('        报告结束');
  lines.push('═'.repeat(60));

  return lines.join('\n');
}

export function downloadReport(report: IsolationReport, level: Level): void {
  const content = formatReportAsText(report, level);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `隔离报告-${report.levelName}-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadReplayData(result: SettlementResult, level: Level): void {
  const data = {
    level,
    settlementResult: result,
    exportedAt: Date.now(),
  };
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `回放数据-${level.name}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getFailureTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    leak_not_isolated: '漏点未隔离',
    pressure_too_low: '压力过低',
    too_many_affected: '影响用户过多',
    main_valve_closed: '误关主阀',
    steps_exceeded: '步骤超限',
    time_exceeded: '时间超限',
  };
  return labels[type] || type;
}
