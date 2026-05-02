import { Level, SimulationState, SimulationRecord, ScoreResult } from '../models/types';
import { getScoreGrade } from '../engine/scoring';
import { downloadFile } from './storage';

export function exportMarkdownReport(
  level: Level,
  finalState: SimulationState,
  scoreResult: ScoreResult
): string {
  const lines: string[] = [];
  
  lines.push('# 浓烟疏散演练复盘报告');
  lines.push('');
  lines.push(`## 关卡信息`);
  lines.push(`- **关卡名称**: ${level.name}`);
  lines.push(`- **关卡大小**: ${level.width} x ${level.height}`);
  lines.push(`- **最大时间步**: ${level.maxTimeSteps}`);
  lines.push(`- **总顾客数**: ${level.customers.length}`);
  lines.push(`- **出口数量**: ${level.exits.length}`);
  lines.push(`- **烟源数量**: ${level.smokeSources.length}`);
  lines.push('');
  
  lines.push('## 模拟结果');
  lines.push(`- **实际时间步**: ${finalState.timeStep}`);
  lines.push(`- **已疏散顾客**: ${finalState.evacuatedCount}`);
  lines.push(`- **被困顾客**: ${finalState.trappedCount}`);
  lines.push(`- **拥堵事件**: ${finalState.congestionEvents.length}`);
  lines.push(`- **逆行事件**: ${finalState.reverseEvents.length}`);
  lines.push(`- **死路事件**: ${finalState.deadEndEvents.length}`);
  lines.push('');
  
  lines.push('## 评分结果');
  lines.push(`- **总分**: ${scoreResult.totalScore}`);
  lines.push(`- **等级**: ${getScoreGrade(scoreResult.totalScore)}`);
  lines.push(`- **基础分**: ${scoreResult.baseScore}`);
  lines.push(`- **拥堵扣分**: -${scoreResult.congestionPenalty}`);
  lines.push(`- **逆行扣分**: -${scoreResult.reversePenalty}`);
  lines.push(`- **死路扣分**: -${scoreResult.deadEndPenalty}`);
  lines.push(`- **超时扣分**: -${scoreResult.timeoutPenalty}`);
  lines.push('');
  
  lines.push('## 扣分原因');
  lines.push('');
  
  for (const reason of scoreResult.reasons) {
    lines.push(`1. ${reason}`);
  }
  lines.push('');
  
  if (finalState.congestionEvents.length > 0) {
    lines.push('## 拥堵事件详情');
    lines.push('');
    
    for (const event of finalState.congestionEvents) {
      lines.push(`### 时间步 ${event.timeStep}`);
      lines.push(`- **位置**: (${event.position.x}, ${event.position.y})`);
      lines.push(`- **涉及顾客数**: ${event.customerIds.length}`);
      lines.push(`- **严重程度**: ${event.severity}`);
      lines.push('');
    }
  }
  
  if (finalState.reverseEvents.length > 0) {
    lines.push('## 逆行事件详情');
    lines.push('');
    
    const groupedByCustomer = new Map<string, typeof finalState.reverseEvents>();
    for (const event of finalState.reverseEvents) {
      if (!groupedByCustomer.has(event.customerId)) {
        groupedByCustomer.set(event.customerId, []);
      }
      groupedByCustomer.get(event.customerId)!.push(event);
    }
    
    let customerIndex = 1;
    for (const [_customerId, events] of groupedByCustomer) {
      lines.push(`### 顾客 ${customerIndex}`);
      for (const event of events) {
        lines.push(`- **时间步 ${event.timeStep}**: 在位置 (${event.position.x}, ${event.position.y}) 改变方向`);
      }
      lines.push('');
      customerIndex++;
    }
  }
  
  if (finalState.deadEndEvents.length > 0) {
    lines.push('## 死路事件详情');
    lines.push('');
    
    for (const event of finalState.deadEndEvents) {
      lines.push(`- **时间步 ${event.timeStep}**: 顾客在位置 (${event.position.x}, ${event.position.y}) 被困死路`);
    }
    lines.push('');
  }
  
  lines.push('## 关卡布局');
  lines.push('');
  lines.push('```');
  lines.push(generateGridVisualization(level));
  lines.push('```');
  lines.push('');
  
  lines.push('### 图例');
  lines.push('- `#` 墙体');
  lines.push('- `E` 出口');
  lines.push('- `F` 烟源（火源）');
  lines.push('- `C` 顾客');
  lines.push('- `S` 指示牌');
  lines.push('- `.` 空地');
  lines.push('');
  
  lines.push('---');
  lines.push('*报告生成时间: ' + new Date().toLocaleString('zh-CN') + '*');
  
  return lines.join('\n');
}

function generateGridVisualization(level: Level): string {
  const lines: string[] = [];
  
  for (let y = 0; y < level.height; y++) {
    let line = '';
    for (let x = 0; x < level.width; x++) {
      const isWall = level.walls.some(w => w.x === x && w.y === y);
      const isExit = level.exits.some(e => e.x === x && e.y === y);
      const isSmoke = level.smokeSources.some(s => s.x === x && s.y === y);
      const hasCustomer = level.customers.some(c => c.position.x === x && c.position.y === y);
      const hasSign = level.signs.some(s => s.position.x === x && s.position.y === y);
      
      if (isWall) {
        line += '#';
      } else if (isExit) {
        line += 'E';
      } else if (isSmoke) {
        line += 'F';
      } else if (hasCustomer) {
        line += 'C';
      } else if (hasSign) {
        line += 'S';
      } else {
        line += '.';
      }
    }
    lines.push(line);
  }
  
  return lines.join('\n');
}

export function exportJSONReplay(
  level: Level,
  states: SimulationState[],
  scoreResult: ScoreResult
): string {
  const record: SimulationRecord = {
    level,
    states,
    scoreResult,
  };
  
  return JSON.stringify(record, null, 2);
}

export function downloadMarkdownReport(
  level: Level,
  finalState: SimulationState,
  scoreResult: ScoreResult,
  filename?: string
): void {
  const content = exportMarkdownReport(level, finalState, scoreResult);
  const actualFilename = filename || `evacuation-report-${Date.now()}.md`;
  downloadFile(content, actualFilename, 'text/markdown');
}

export function downloadJSONReplay(
  level: Level,
  states: SimulationState[],
  scoreResult: ScoreResult,
  filename?: string
): void {
  const content = exportJSONReplay(level, states, scoreResult);
  const actualFilename = filename || `evacuation-replay-${Date.now()}.json`;
  downloadFile(content, actualFilename, 'application/json');
}
