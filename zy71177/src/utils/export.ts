import { GameRecord, ScoreBreakdown } from '../types';
import { getFailReasonDescription } from './scoring';

export const generateReportText = (record: GameRecord, scoreBreakdown: ScoreBreakdown): string => {
  const failInfo = getFailReasonDescription(record.failReason);
  
  let report = `
╔══════════════════════════════════════════════════════════════╗
║              污水处理厂药剂投加模拟运行报告                     ║
╚══════════════════════════════════════════════════════════════╝

【基本信息】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  关卡名称: ${record.levelName}
  游戏ID: ${record.id}
  开始时间: ${new Date(record.startTime).toLocaleString('zh-CN')}
  结束时间: ${new Date(record.endTime).toLocaleString('zh-CN')}
  游戏时长: ${Math.floor((record.endTime - record.startTime) / 1000)} 秒

【游戏结果】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  最终得分: ${scoreBreakdown.finalScore} 分
  星级评价: ${'★'.repeat(scoreBreakdown.stars)}${'☆'.repeat(3 - scoreBreakdown.stars)}
  完成状态: ${record.success ? '✓ 成功通关' : '✗ 未通过'}
  完成回合: ${record.roundsCompleted} / ${record.maxRounds} 回合
  达标回合: ${record.successCount} 回合
  总成本: ¥${record.totalCost.toFixed(2)}

【得分明细】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  基础分数: +${scoreBreakdown.baseScore}
    (达标回合 × 100分)
  成本扣分: -${scoreBreakdown.costPenalty}
    (实际成本/最优成本 × 50分)
  搅拌不足扣分: -${scoreBreakdown.stirringPenalty}
    (${record.insufficientStirringCount}次 × 20分)
  超量投加扣分: -${scoreBreakdown.overdosePenalty}
    (${record.overdoseCount}次 × 30分)

【操作统计】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  总操作次数: ${record.actions.length} 次
  搅拌不足次数: ${record.insufficientStirringCount} 次
  超量投加次数: ${record.overdoseCount} 次
`;

  if (!record.success && record.failReason) {
    report += `
【失败分析】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  失败原因: ${failInfo.title}
  改进建议: ${failInfo.suggestion}
`;
  }

  report += `
【回合详情】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  record.qualityHistory.forEach((q, index) => {
    const isFirst = index === 0;
    const action = record.actions.find(a => a.round === Math.ceil(index / 2));
    report += `  回合 ${Math.ceil((index + 1) / 2)}${isFirst ? ' (初始)' : ''}: 
    COD: ${q.cod.toFixed(1)} mg/L | 氨氮: ${q.nh3n.toFixed(1)} mg/L | 总磷: ${q.tp.toFixed(2)} mg/L | pH: ${q.ph.toFixed(1)}
`;
    if (action) {
      report += `    操作: 投加 ${action.chemicalAmount?.toFixed(0) || 0} mg 药剂, 搅拌 ${action.stirringTime?.toFixed(0) || 0} 秒, 成本 ¥${action.cost.toFixed(2)}\n`;
    }
  });

  report += `
══════════════════════════════════════════════════════════════
                      报告生成完毕
══════════════════════════════════════════════════════════════
`;

  return report;
};

export const exportReportAsText = (record: GameRecord, scoreBreakdown: ScoreBreakdown): void => {
  const reportText = generateReportText(record, scoreBreakdown);
  const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `污水处理报告_${record.levelName}_${new Date(record.endTime).toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportReportAsJSON = (record: GameRecord, scoreBreakdown: ScoreBreakdown): void => {
  const exportData = {
    record,
    scoreBreakdown,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `污水处理报告_${record.levelName}_${new Date(record.endTime).toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
