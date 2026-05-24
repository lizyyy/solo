import { GameState, ScoreDetail, HistoryRecord, SUPPLY_CONFIGS } from '../types';
import { formatTime } from '../game/engine';

export const exportToJSON = (state: GameState): string => {
  const exportData = {
    levelId: state.levelId,
    turn: state.turn,
    maxTurns: state.maxTurns,
    weather: state.weather,
    score: state.score,
    scoreDetails: state.scoreDetails,
    elapsedTime: formatTime(state.elapsedTime),
    failReason: state.failReason,
    warehouseSupplies: state.warehouseSupplies,
    shelters: state.nodes
      .filter((n) => n.type === 'shelter')
      .map((n) => ({
        name: n.name,
        demand: n.demand,
        received: n.received,
      })),
    eventLog: state.eventLog.slice(-20),
  };

  return JSON.stringify(exportData, null, 2);
};

export const downloadJSON = (state: GameState, filename: string = '配送报告.json') => {
  const json = exportToJSON(state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportToText = (state: GameState, levelName: string): string => {
  const lines: string[] = [];
  
  lines.push('='.repeat(50));
  lines.push('           灾后物资配送报告');
  lines.push('='.repeat(50));
  lines.push('');
  
  lines.push(`关卡: ${levelName}`);
  lines.push(`回合: ${state.turn} / ${state.maxTurns}`);
  lines.push(`用时: ${formatTime(state.elapsedTime)}`);
  lines.push(`天气: ${state.weather === 'sunny' ? '晴朗' : state.weather === 'rainy' ? '降雨' : '暴风雨'}`);
  lines.push(`最终得分: ${state.score}`);
  lines.push('');
  
  if (state.failReason) {
    lines.push(`任务状态: 失败 - ${state.failReason}`);
  } else {
    lines.push('任务状态: 成功完成！');
  }
  lines.push('');
  
  lines.push('-'.repeat(50));
  lines.push('得分详情');
  lines.push('-'.repeat(50));
  
  state.scoreDetails.forEach((detail) => {
    const sign = detail.score >= 0 ? '+' : '';
    lines.push(`${detail.category}: ${sign}${detail.score} / ${detail.maxScore}`);
    lines.push(`  ${detail.description}`);
  });
  lines.push('');
  
  lines.push('-'.repeat(50));
  lines.push('安置点配送情况');
  lines.push('-'.repeat(50));
  
  state.nodes.filter((n) => n.type === 'shelter').forEach((shelter) => {
    lines.push(`\n【${shelter.name}】`);
    if (shelter.demand && shelter.received) {
      SUPPLY_CONFIGS.forEach((supply) => {
        const received = shelter.received![supply.type];
        const demand = shelter.demand![supply.type];
        const status = received >= demand ? '✓' : `欠${demand - received}`;
        lines.push(`  ${supply.emoji} ${supply.name}: ${received}/${demand} ${status}`);
      });
    }
  });
  lines.push('');
  
  lines.push('-'.repeat(50));
  lines.push('事件日志 (最近10条)');
  lines.push('-'.repeat(50));
  
  state.eventLog.slice(-10).forEach((log, i) => {
    lines.push(`${i + 1}. ${log}`);
  });
  
  lines.push('');
  lines.push('='.repeat(50));
  lines.push('报告生成时间: ' + new Date().toLocaleString('zh-CN'));
  lines.push('='.repeat(50));
  
  return lines.join('\n');
};

export const downloadText = (state: GameState, levelName: string, filename: string = '配送报告.txt') => {
  const text = exportToText(state, levelName);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
