import type { GameRecord, Level, GameEvent, ScoreResult, EventType } from './types';
import { calculateScore, PENALTIES } from './scoring';

export function generateReport(record: GameRecord, level: Level): object {
  const scoreResult = calculateScore(record.events, level.maxRounds, record.totalRounds);
  const riskStats = calculateRiskStatistics(record.events);

  return {
    basicInfo: {
      levelId: level.id,
      levelName: level.name,
      difficulty: level.difficulty,
      timestamp: record.timestamp,
      date: new Date(record.timestamp).toLocaleString(),
      totalRounds: record.totalRounds,
      maxRounds: level.maxRounds,
      result: record.success ? 'success' : 'failed',
      rating: record.rating,
      totalScore: record.totalScore,
    },
    routeInfo: {
      totalSteps: record.path.length,
      startPosition: record.path[0] ?? null,
      endPosition: record.path[record.path.length - 1] ?? null,
      path: record.path,
    },
    eventTimeline: formatEventTimeline(record.events),
    scoreDetails: {
      ...scoreResult,
      explanation: generateScoreExplanation(scoreResult),
    },
    riskStatistics: riskStats,
    failReason: !record.success ? getFailReasonAnalysis(record) : null,
  };
}

export function formatEventTimeline(events: GameEvent[]): Array<{
  round: number;
  type: EventType;
  position: { x: number; y: number };
  description: string;
  scoreChange: number;
}> {
  return events.map((event, index) => ({
    round: event.round ?? index + 1,
    type: event.type,
    position: { x: event.position.x, y: event.position.y },
    description: event.description || event.message || getDefaultEventDescription(event.type),
    scoreChange: event.scoreChange,
  }));
}

export function generateScoreExplanation(scoreResult: ScoreResult): string {
  const parts: string[] = [];
  parts.push(`基础分: ${scoreResult.baseScore}`);
  parts.push(`时间奖励: ${scoreResult.timeBonus}`);
  parts.push(`事件得分: ${scoreResult.eventScores}`);

  if (scoreResult.penalties && scoreResult.penalties.length > 0) {
    const penaltyTypes = scoreResult.penalties.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

    const penaltyDesc = Object.entries(penaltyTypes)
      .map(([type, amount]) => `${type}(-${amount})`)
      .join(', ');
    parts.push(`扣分项: ${penaltyDesc}`);
  }

  parts.push(`总分: ${scoreResult.totalScore}`);
  parts.push(`评级: ${scoreResult.rating}`);

  return parts.join(' | ');
}

export function exportToJSON(report: object): string {
  return JSON.stringify(report, null, 2);
}

export function getFailReasonAnalysis(record: GameRecord): string {
  if (record.success) return '任务成功完成，无失败原因。';

  const failReason = record.failReason || '未知原因';
  const events = record.events;

  const criticalEvents = events.filter((e) => e.scoreChange <= -200);
  const guardSpottedCount = events.filter((e) => e.type === 'guard_spotted').length;
  const humidityDamageCount = events.filter((e) => e.type === 'humidity_damage').length;
  const timeoutCount = events.filter((e) => e.type === 'timeout').length;
  const alertCount = events.filter((e) => e.type === 'alert').length;

  const analysis: string[] = [];
  analysis.push(`失败原因: ${failReason}`);
  analysis.push(`总回合数: ${record.totalRounds}`);
  analysis.push(`最终得分: ${record.totalScore}`);

  if (guardSpottedCount > 0) {
    analysis.push(`- 被警卫发现 ${guardSpottedCount} 次，这是主要失败原因之一`);
  }
  if (humidityDamageCount > 0) {
    analysis.push(`- 湿度损坏 ${humidityDamageCount} 次，展品保护措施不足`);
  }
  if (timeoutCount > 0) {
    analysis.push(`- 超时 ${timeoutCount} 次，路线规划效率低下`);
  }
  if (alertCount > 0) {
    analysis.push(`- 触发警报 ${alertCount} 次，行动不够谨慎`);
  }

  if (criticalEvents.length > 0) {
    const lastCritical = criticalEvents[criticalEvents.length - 1];
    analysis.push(`- 最后一次严重失误发生在第 ${lastCritical.round} 回合: ${lastCritical.description || lastCritical.type}`);
  }

  return analysis.join('\n');
}

function getDefaultEventDescription(type: EventType): string {
  const descriptions: Record<EventType, string> = {
    move: '移动',
    door_open: '开门',
    humidity: '湿度影响',
    congestion: '拥堵区域',
    alert: '触发警报',
    guard_spotted: '被警卫发现',
    item_used: '使用物品',
    timeout: '超时',
    humidity_damage: '湿度损坏',
    door_permission_denied: '门禁权限不足',
    wrong_operation: '操作错误',
    resource_waste: '资源浪费',
    door_blocked: '门被阻挡',
    success: '任务完成',
  };
  return descriptions[type] || type;
}

function calculateRiskStatistics(events: GameEvent[]): {
  totalRisks: number;
  riskByType: Record<string, number>;
  totalPenalty: number;
  averageRiskPerRound: number;
} {
  const riskByType: Record<string, number> = {};
  let totalPenalty = 0;
  let totalRisks = 0;

  events.forEach((event) => {
    if (event.scoreChange < 0) {
      totalRisks++;
      totalPenalty += Math.abs(event.scoreChange);
      riskByType[event.type] = (riskByType[event.type] || 0) + 1;
    }
  });

  return {
    totalRisks,
    riskByType,
    totalPenalty,
    averageRiskPerRound: events.length > 0 ? totalRisks / events.length : 0,
  };
}
