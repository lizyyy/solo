import { Level, SimulationState, ScoreResult } from '../models/types';

export const BASE_SCORE_PER_CUSTOMER = 100;
export const CONGESTION_PENALTY_PER_EVENT = 20;
export const REVERSE_PENALTY_PER_EVENT = 15;
export const DEAD_END_PENALTY_PER_CUSTOMER = 50;
export const TIMEOUT_PENALTY_PER_STEP = 5;
export const TRAPPED_PENALTY = 100;

export function calculateScore(
  level: Level,
  state: SimulationState
): ScoreResult {
  const reasons: string[] = [];
  
  const totalCustomers = level.customers.length;
  const baseScore = totalCustomers * BASE_SCORE_PER_CUSTOMER;
  
  let congestionPenalty = 0;
  const congestionEvents = state.congestionEvents;
  
  for (const event of congestionEvents) {
    const penalty = CONGESTION_PENALTY_PER_EVENT * event.severity;
    congestionPenalty += penalty;
    reasons.push(
      `时间步 ${event.timeStep}: 位置 (${event.position.x}, ${event.position.y}) 发生拥堵，${event.customerIds.length} 名顾客被困，扣 ${penalty} 分`
    );
  }
  
  let reversePenalty = 0;
  const reverseEvents = state.reverseEvents;
  const uniqueReverseCustomers = new Set<string>();
  
  for (const event of reverseEvents) {
    if (!uniqueReverseCustomers.has(event.customerId)) {
      uniqueReverseCustomers.add(event.customerId);
      reversePenalty += REVERSE_PENALTY_PER_EVENT;
      reasons.push(
        `时间步 ${event.timeStep}: 顾客改变移动方向（逆行），扣 ${REVERSE_PENALTY_PER_EVENT} 分`
      );
    }
  }
  
  let deadEndPenalty = 0;
  const deadEndEvents = state.deadEndEvents;
  const uniqueDeadEndCustomers = new Set<string>();
  
  for (const event of deadEndEvents) {
    if (!uniqueDeadEndCustomers.has(event.customerId)) {
      uniqueDeadEndCustomers.add(event.customerId);
      deadEndPenalty += DEAD_END_PENALTY_PER_CUSTOMER;
      reasons.push(
        `时间步 ${event.timeStep}: 顾客被困在死路位置 (${event.position.x}, ${event.position.y})，扣 ${DEAD_END_PENALTY_PER_CUSTOMER} 分`
      );
    }
  }
  
  let timeoutPenalty = 0;
  const maxTimeSteps = level.maxTimeSteps;
  const actualTimeSteps = state.timeStep;
  
  if (state.trappedCount > 0 && actualTimeSteps >= maxTimeSteps) {
    const trappedCustomers = state.customers.filter(c => c.isTrapped);
    for (const customer of trappedCustomers) {
      if (!uniqueDeadEndCustomers.has(customer.id)) {
        timeoutPenalty += TRAPPED_PENALTY;
        reasons.push(
          `顾客在位置 (${customer.position.x}, ${customer.position.y}) 因超时被困，扣 ${TRAPPED_PENALTY} 分`
        );
      }
    }
  }
  
  const totalPenalty = congestionPenalty + reversePenalty + deadEndPenalty + timeoutPenalty;
  const totalScore = Math.max(0, baseScore - totalPenalty);
  
  if (reasons.length === 0) {
    reasons.push('所有顾客成功疏散，无任何违规行为！');
  }
  
  return {
    totalScore,
    baseScore,
    congestionPenalty,
    reversePenalty,
    deadEndPenalty,
    timeoutPenalty,
    reasons,
  };
}

export function getScoreGrade(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 50) return '及格';
  return '不及格';
}

export function formatScoreResult(result: ScoreResult): string {
  const lines: string[] = [];
  
  lines.push('=== 评分结果 ===');
  lines.push(`总分: ${result.totalScore}`);
  lines.push(`基础分: ${result.baseScore}`);
  lines.push(`拥堵扣分: -${result.congestionPenalty}`);
  lines.push(`逆行扣分: -${result.reversePenalty}`);
  lines.push(`死路扣分: -${result.deadEndPenalty}`);
  lines.push(`超时扣分: -${result.timeoutPenalty}`);
  lines.push('');
  lines.push('扣分原因:');
  
  for (const reason of result.reasons) {
    lines.push(`- ${reason}`);
  }
  
  return lines.join('\n');
}
