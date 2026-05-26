import { GameHistory, InspectionRecord } from '../types';

export function exportToJSON(history: GameHistory): void {
  const dataStr = JSON.stringify(history, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `inspection_report_${history.levelId}_${new Date(history.startTime).toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCSV(history: GameHistory): void {
  const headers = [
    '序号',
    '箱号',
    '车牌',
    '是否危品',
    '操作',
    '是否正确',
    '错误原因',
    '分数变化',
    '处理时间(秒)',
    '时间戳',
  ];
  
  const rows = history.records.map((record, index) => [
    index + 1,
    record.containerNo,
    record.licensePlate,
    record.hasDangerous ? '是' : '否',
    record.playerAction === 'pass' ? '放行' : record.playerAction === 'intercept' ? '拦截' : '超时',
    record.isCorrect ? '是' : '否',
    record.errorReason || '',
    record.scoreChange,
    record.timeSpent.toFixed(2),
    new Date(record.timestamp).toLocaleString(),
  ]);
  
  const summary = [
    [],
    ['游戏总结'],
    ['关卡', history.levelName],
    ['最终得分', history.score],
    ['准确率', `${history.accuracy}%`],
    ['处理车辆数', history.totalVehicles],
    ['正确数', history.correctCount],
    ['错误数', history.errorCount],
    ['游戏时长(秒)', (history.duration / 1000).toFixed(2)],
    ['开始时间', new Date(history.startTime).toLocaleString()],
    ['结束时间', new Date(history.endTime).toLocaleString()],
  ];
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
    ...summary.map(row => row.join(',')),
  ].join('\n');
  
  const BOM = '\uFEFF';
  const dataBlob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `inspection_report_${history.levelId}_${new Date(history.startTime).toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateErrorStats(records: InspectionRecord[]): Record<string, number> {
  const stats: Record<string, number> = {};
  
  records.forEach(record => {
    if (!record.isCorrect && record.errorReason) {
      stats[record.errorReason] = (stats[record.errorReason] || 0) + 1;
    }
  });
  
  return stats;
}

export function generateReportText(history: GameHistory): string {
  const errorStats = generateErrorStats(history.records);
  
  let report = `
╔══════════════════════════════════════════════════════════════╗
║                码头闸口验放报告                              ║
╠══════════════════════════════════════════════════════════════╣
║  关卡: ${history.levelName.padEnd(51)}║
║  开始时间: ${new Date(history.startTime).toLocaleString().padEnd(45)}║
║  结束时间: ${new Date(history.endTime).toLocaleString().padEnd(45)}║
║  游戏时长: ${(history.duration / 1000).toFixed(2)}秒${' '.repeat(44)}║
╠══════════════════════════════════════════════════════════════╣
║  最终得分: ${String(history.score).padEnd(48)}║
║  准确率: ${String(history.accuracy).padEnd(2)}%${' '.repeat(48)}║
║  处理车辆: ${history.totalVehicles}辆${' '.repeat(46)}║
║  正确: ${history.correctCount}辆${' '.repeat(48)}║
║  错误: ${history.errorCount}辆${' '.repeat(48)}║
╠══════════════════════════════════════════════════════════════╣
║  错误类型统计:                                               ║
`;

  Object.entries(errorStats).forEach(([type, count]) => {
    report += `║    ${type}: ${count}次${' '.repeat(48 - type.length - String(count).length)}║\n`;
  });

  if (Object.keys(errorStats).length === 0) {
    report += `║    无错误记录，完美通关！${' '.repeat(38)}║\n`;
  }

  report += `╚══════════════════════════════════════════════════════════════╝`;

  return report;
}
