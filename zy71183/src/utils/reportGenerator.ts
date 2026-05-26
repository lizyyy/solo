import type { GameState, LevelConfig, ScoreDetail } from '../types';

export interface InspectionReport {
  title: string;
  generatedAt: string;
  levelName: string;
  inspector: string;
  duration: string;
  score: number;
  items: ReportItem[];
  anomalies: ReportAnomaly[];
  summary: string;
  suggestions: string[];
}

export interface ReportItem {
  name: string;
  status: 'completed' | 'skipped' | 'wrong';
  remark: string;
}

export interface ReportAnomaly {
  description: string;
  severity: string;
  handled: boolean;
  upgraded: boolean;
}

export function generateReport(
  gameState: GameState,
  levelConfig: LevelConfig
): InspectionReport {
  const { completedSteps, skippedSteps, wrongSteps, activeAnomalies, score, timeRemaining } = gameState;
  const { inspectionPoints, requiredOrder, timeLimit, name } = levelConfig;

  const items: ReportItem[] = requiredOrder.map((pointId) => {
    const point = inspectionPoints.find(p => p.id === pointId);
    if (!point) return { name: pointId, status: 'skipped', remark: '巡检点不存在' };

    if (completedSteps.includes(pointId)) {
      return { name: point.name, status: 'completed', remark: '已完成巡检' };
    }
    if (wrongSteps.includes(pointId)) {
      return { name: point.name, status: 'wrong', remark: '顺序错误' };
    }
    if (skippedSteps.includes(pointId)) {
      return { name: point.name, status: 'skipped', remark: '漏检' };
    }
    return { name: point.name, status: 'skipped', remark: '未完成' };
  });

  const anomalies: ReportAnomaly[] = activeAnomalies.map(a => ({
    description: a.description,
    severity: a.severity === 'critical' ? '严重' : '警告',
    handled: a.isHandled,
    upgraded: a.isUpgraded,
  }));

  const timeTaken = timeLimit - timeRemaining;
  const minutes = Math.floor(timeTaken / 60);
  const seconds = timeTaken % 60;

  const unhandledAnomalies = activeAnomalies.filter(a => !a.isHandled).length;
  const notUpgradedCritical = activeAnomalies.filter(a => a.severity === 'critical' && !a.isUpgraded).length;

  let summary = '';
  if (unhandledAnomalies > 0 || notUpgradedCritical > 0) {
    summary = '本次巡检存在未处理的异常事件，需要及时跟进处理。';
  } else if (skippedSteps.length > 0) {
    summary = '本次巡检存在漏检项目，需要重新检查遗漏部分。';
  } else if (wrongSteps.length > 0) {
    summary = '本次巡检顺序存在错误，请按照标准流程执行。';
  } else {
    summary = '本次巡检完成度良好，请继续保持。';
  }

  const suggestions: string[] = [];
  if (wrongSteps.length > 0) {
    suggestions.push('加强巡检顺序培训，牢记标准巡检流程。');
  }
  if (skippedSteps.length > 0) {
    suggestions.push('使用巡检清单逐条核对，避免漏检。');
  }
  if (unhandledAnomalies > 0) {
    suggestions.push('发现异常时应立即处理，并记录在巡检表中。');
  }
  if (notUpgradedCritical > 0) {
    suggestions.push('严重异常必须及时上报上级部门。');
  }
  if (suggestions.length === 0) {
    suggestions.push('继续保持良好的巡检习惯。');
  }

  return {
    title: '配电房巡检报告',
    generatedAt: new Date().toLocaleString('zh-CN'),
    levelName: name,
    inspector: '培训学员',
    duration: `${minutes}分${seconds}秒`,
    score,
    items,
    anomalies,
    summary,
    suggestions,
  };
}

export function formatReportAsText(report: InspectionReport): string {
  let text = '';
  
  text += `========================================\n`;
  text += `           ${report.title}\n`;
  text += `========================================\n\n`;
  
  text += `生成时间：${report.generatedAt}\n`;
  text += `巡检关卡：${report.levelName}\n`;
  text += `巡检人员：${report.inspector}\n`;
  text += `用时：${report.duration}\n`;
  text += `得分：${report.score}\n\n`;
  
  text += `----------------------------------------\n`;
  text += `              巡检项目明细\n`;
  text += `----------------------------------------\n\n`;
  
  report.items.forEach((item, index) => {
    const statusText = item.status === 'completed' ? '✓ 完成' : 
                       item.status === 'wrong' ? '✗ 顺序错误' : '△ 漏检';
    text += `${index + 1}. ${item.name} - ${statusText}\n`;
    if (item.remark) {
      text += `   备注：${item.remark}\n`;
    }
    text += '\n';
  });
  
  if (report.anomalies.length > 0) {
    text += `----------------------------------------\n`;
    text += `              异常事件记录\n`;
    text += `----------------------------------------\n\n`;
    
    report.anomalies.forEach((anomaly, index) => {
      text += `${index + 1}. [${anomaly.severity}] ${anomaly.description}\n`;
      text += `   处理状态：${anomaly.handled ? '已处理' : '未处理'}\n`;
      if (anomaly.severity === '严重') {
        text += `   升级状态：${anomaly.upgraded ? '已上报' : '未上报'}\n`;
      }
      text += '\n';
    });
  }
  
  text += `----------------------------------------\n`;
  text += `              巡检总结\n`;
  text += `----------------------------------------\n\n`;
  text += `${report.summary}\n\n`;
  
  text += `----------------------------------------\n`;
  text += `              改进建议\n`;
  text += `----------------------------------------\n\n`;
  
  report.suggestions.forEach((suggestion, index) => {
    text += `${index + 1}. ${suggestion}\n`;
  });
  
  text += `\n========================================\n`;
  text += `           报告结束\n`;
  text += `========================================\n`;
  
  return text;
}

export function getScoreExplanation(scoreDetails: ScoreDetail[]): string {
  const explanations: string[] = [];
  
  scoreDetails.forEach(detail => {
    const prefix = detail.points > 0 ? '+' : '';
    explanations.push(`${detail.description}: ${prefix}${detail.points}分`);
  });
  
  return explanations.join('\n');
}
