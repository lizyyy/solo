import { GameHistory, ScoreBreakdown } from '../types/game';

export const exportToJSON = (data: unknown, filename: string): void => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export JSON:', error);
  }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (execError) {
      document.body.removeChild(textArea);
      console.error('Fallback copy failed:', execError);
      return false;
    }
  }
};

export const generateReport = (
  history: GameHistory,
  scoreBreakdown: ScoreBreakdown
): string => {
  const date = new Date(history.timestamp).toLocaleString('zh-CN');
  
  let report = `# 餐厨油脂回收游戏 - 结算报告\n\n`;
  report += `## 基本信息\n\n`;
  report += `- 游戏ID: ${history.id}\n`;
  report += `- 游戏时间: ${date}\n`;
  report += `- 关卡名称: ${history.levelName}\n`;
  report += `- 游戏结果: ${history.isWin ? '✅ 胜利' : '❌ 失败'}\n`;
  if (history.failureReason) {
    report += `- 失败原因: ${history.failureReason}\n`;
  }
  report += `- 最终得分: ${history.finalScore}\n`;
  report += `- 使用回合: ${history.totalTurns}/${history.maxTurns}\n\n`;
  
  report += `## 得分明细\n\n`;
  report += `| 项目 | 分数 |\n`;
  report += `|------|------|\n`;
  report += `| 基础分 | +${scoreBreakdown.baseScore} |\n`;
  report += `| 效率奖励 | +${scoreBreakdown.efficiencyBonus} |\n`;
  report += `| 容量奖励 | +${scoreBreakdown.capacityBonus} |\n`;
  report += `| 回合奖励 | +${scoreBreakdown.turnBonus} |\n`;
  report += `| 溢出惩罚 | ${scoreBreakdown.overflowPenalty} |\n`;
  report += `| 投诉惩罚 | ${scoreBreakdown.complaintPenalty} |\n`;
  report += `| **总计** | **${scoreBreakdown.total}** |\n\n`;
  
  report += `## 回合详情\n\n`;
  
  for (let i = 0; i < history.turns.length; i++) {
    const turn = history.turns[i];
    report += `### 第 ${turn.turn} 回合\n\n`;
    report += `- 行驶距离: ${turn.totalDistance}\n`;
    report += `- 本回合得分: ${turn.scoreThisTurn}\n`;
    report += `- 本回合投诉: ${turn.complaints}\n`;
    
    const collectedRestaurants = Object.keys(turn.collectedOil);
    if (collectedRestaurants.length > 0) {
      report += `- 收集油脂:\n`;
      for (const [restaurantId, amount] of Object.entries(turn.collectedOil)) {
        const restaurant = history.initialRestaurants.find(r => r.id === restaurantId);
        const name = restaurant ? restaurant.name : restaurantId;
        report += `  - ${name}: ${amount} 单位\n`;
      }
    }
    
    const overflowing = turn.restaurantStates.filter(r => r.isOverflowing);
    if (overflowing.length > 0) {
      report += `- ⚠️ 溢出餐馆:\n`;
      for (const state of overflowing) {
        const restaurant = history.initialRestaurants.find(r => r.id === state.id);
        const name = restaurant ? restaurant.name : state.id;
        report += `  - ${name}: ${state.currentOil} 单位\n`;
      }
    }
    
    if (turn.event) {
      report += `- 事件卡: ${turn.event.title}\n`;
      report += `  ${turn.event.description}\n`;
    }
    
    report += `\n`;
  }
  
  return report;
};
