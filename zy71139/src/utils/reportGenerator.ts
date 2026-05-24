import { ReportData, SimulationRecord, SimulationError, FanOperation, TimeStep } from '../types';

export const generateReport = (record: SimulationRecord): ReportData => {
  const errorsByType = groupErrorsByType(record.errors);
  
  const blockedTime = record.timeSteps.reduce((acc, step) => {
    return acc + step.escapeRoutesBlocked.length;
  }, 0);

  const score = calculateFinalScore(record.errors.length, blockedTime, record.timeSteps.length);

  return {
    summary: {
      totalTime: Math.round((record.endTime - record.startTime) / 1000),
      totalSteps: record.timeSteps.length,
      errorCount: record.errors.length,
      criticalErrors: record.errors.filter(e => e.severity === 'critical').length,
      score
    },
    timeline: record.timeSteps.slice(0, 50),
    operations: record.fanOperations,
    errors: errorsByType,
    recommendations: generateRecommendations(errorsByType, record.timeSteps)
  };
};

const groupErrorsByType = (errors: SimulationError[]) => {
  return {
    fan_wrong_direction: errors.filter(e => e.type === 'fan_wrong_direction'),
    escape_blocked: errors.filter(e => e.type === 'escape_blocked'),
    timestep_error: errors.filter(e => e.type === 'timestep_error')
  };
};

const calculateFinalScore = (
  errorCount: number,
  blockedTime: number,
  totalSteps: number
): number => {
  let score = 100;
  
  score -= errorCount * 5;
  score -= Math.min(30, blockedTime * 2);
  
  return Math.max(0, score);
};

const generateRecommendations = (
  errors: {
    fan_wrong_direction: SimulationError[];
    escape_blocked: SimulationError[];
    timestep_error: SimulationError[];
  },
  timeSteps: TimeStep[]
): string[] => {
  const recommendations: string[] = [];

  if (errors.fan_wrong_direction.length > 0) {
    recommendations.push(
      '建议：在启动风机前确认正确的排烟方向，中段风机应与整体排烟策略保持一致',
      '提示：通常烟气应向隧道出口方向排放，避免在隧道中部产生反向气流'
    );
  }

  if (errors.escape_blocked.length > 0) {
    recommendations.push(
      '警告：逃生通道被烟气覆盖是严重问题！请确保在演练初期就建立有效的排烟屏障',
      '建议：在逃生通道附近设置正压送风，防止烟气侵入'
    );
  }

  if (errors.timestep_error.length > 0) {
    recommendations.push(
      '注意：时间步跳变过大可能影响演练效果评估，建议逐步调整风机参数',
      '提示：使用时间轴进行慢速回放，仔细观察烟气扩散规律'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      '操作规范，风机方向控制正确',
      '逃生通道保护良好，排烟策略有效',
      '演练完成度高，继续保持！'
    );
  }

  return recommendations;
};

export const exportReportAsJSON = (report: ReportData): string => {
  return JSON.stringify(report, null, 2);
};

export const exportReportAsText = (report: ReportData): string => {
  const lines: string[] = [];
  
  lines.push('='.repeat(50));
  lines.push('隧道通风烟气演练报告');
  lines.push('='.repeat(50));
  lines.push('');
  
  lines.push('【演练总结】');
  lines.push(`演练时长：${report.summary.totalTime} 秒`);
  lines.push(`时间步数：${report.summary.totalSteps} 步`);
  lines.push(`错误总数：${report.summary.errorCount} 个`);
  lines.push(`严重错误：${report.summary.criticalErrors} 个`);
  lines.push(`最终得分：${report.summary.score} 分`);
  lines.push('');
  
  lines.push('【操作记录】');
  report.operations.forEach((op, index) => {
    const actionText = getActionText(op);
    lines.push(`  ${index + 1}. 步骤 ${op.step}: ${actionText}`);
  });
  lines.push('');
  
  lines.push('【问题记录】');
  if (report.errors.fan_wrong_direction.length > 0) {
    lines.push(`  风机方向问题：${report.errors.fan_wrong_direction.length} 处`);
  }
  if (report.errors.escape_blocked.length > 0) {
    lines.push(`  逃生通道被堵：${report.errors.escape_blocked.length} 次`);
  }
  if (report.errors.timestep_error.length > 0) {
    lines.push(`  时间步异常：${report.errors.timestep_error.length} 次`);
  }
  lines.push('');
  
  lines.push('【改进建议】');
  report.recommendations.forEach((rec, index) => {
    lines.push(`  ${index + 1}. ${rec}`);
  });
  lines.push('');
  
  lines.push('='.repeat(50));
  lines.push('报告生成时间：' + new Date().toLocaleString('zh-CN'));
  lines.push('='.repeat(50));
  
  return lines.join('\n');
};

const getActionText = (op: FanOperation): string => {
  switch (op.action) {
    case 'toggle':
      return op.value ? '开启风机' : '关闭风机';
    case 'direction':
      return `切换风机方向为 ${op.value === 'forward' ? '正向' : '反向'}`;
    case 'power':
      return `调整风机功率为 ${op.value}%`;
    default:
      return '未知操作';
  }
};

export const downloadReport = (
  report: ReportData,
  format: 'json' | 'txt'
) => {
  let content: string;
  let filename: string;
  let mimeType: string;

  if (format === 'json') {
    content = exportReportAsJSON(report);
    filename = `tunnel-simulation-report-${Date.now()}.json`;
    mimeType = 'application/json';
  } else {
    content = exportReportAsText(report);
    filename = `tunnel-simulation-report-${Date.now()}.txt`;
    mimeType = 'text/plain';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
