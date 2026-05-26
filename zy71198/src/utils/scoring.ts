import { ScoreBreakdown, ActionRecord, StreetLamp, Priority } from '@/types/game';

export function getInitialScoreBreakdown(): ScoreBreakdown {
  return {
    baseScore: 0,
    priorityBonus: 0,
    timeBonus: 0,
    errorPenalty: 0,
    timeoutPenalty: 0,
    wastePenalty: 0,
    routeCostPenalty: 0,
  };
}

export function calculateTotalScore(breakdown: ScoreBreakdown): number {
  return (
    breakdown.baseScore +
    breakdown.priorityBonus +
    breakdown.timeBonus -
    breakdown.errorPenalty -
    breakdown.timeoutPenalty -
    breakdown.wastePenalty -
    breakdown.routeCostPenalty
  );
}

export function getPriorityScoreMultiplier(priority: Priority): number {
  switch (priority) {
    case 'critical':
      return 1.5;
    case 'high':
      return 1.2;
    case 'normal':
      return 1.0;
    case 'low':
    default:
      return 0.8;
  }
}

export function calculateRepairScore(lamp: StreetLamp, timeRemaining: number): {
  baseScore: number;
  priorityBonus: number;
  timeBonus: number;
} {
  const baseScore = lamp.baseScore;
  const priorityBonus = Math.round(lamp.baseScore * (getPriorityScoreMultiplier(lamp.priority) - 1));
  const timeBonus = Math.max(0, Math.floor(timeRemaining / 10) * 5);

  return { baseScore, priorityBonus, timeBonus };
}

export function calculateRouteCostPenalty(
  routeCost: number,
  optimalCost: number
): number {
  if (optimalCost <= 0) return 0;
  const overRatio = (routeCost - optimalCost) / optimalCost;
  if (overRatio <= 0.5) return 0;
  const excess = overRatio - 0.5;
  return Math.round(excess * 10 * 5);
}

export function getGrade(score: number, breakdown: ScoreBreakdown, _totalLamps: number): string {
  if (score >= 900 && breakdown.timeoutPenalty === 0) return 'S';
  if (score >= 750) return 'A';
  if (score >= 600) return 'B';
  if (score >= 450) return 'C';
  return 'D';
}

export function getFailureReason(
  breakdown: ScoreBreakdown,
  lamps: StreetLamp[],
  _vehicles: unknown
): string | null {
  const timedOut = lamps.filter((l) => l.status === 'timeout');
  const unrepaired = lamps.filter((l) => l.status === 'broken' || l.status === 'assigned');

  if (timedOut.length > 0 && timedOut.length >= lamps.length * 0.5) {
    return '大量路灯超时未维修，调度效率过低。';
  }

  if (unrepaired.length > 0) {
    return `仍有 ${unrepaired.length} 盏路灯未完成维修。`;
  }

  if (breakdown.errorPenalty > breakdown.baseScore * 0.3) {
    return '错误操作频繁，扣分过多。';
  }

  if (breakdown.wastePenalty > breakdown.baseScore * 0.25) {
    return '资源浪费严重，路线规划不合理。';
  }

  if (breakdown.routeCostPenalty > breakdown.baseScore * 0.3) {
    return '路线成本过高，建议选择更短路径。';
  }

  return null;
}

export function createActionRecord(
  type: ActionRecord['type'],
  details: string,
  scoreChange: number,
  gameTime: number,
  vehicleId?: string,
  lampId?: string
): ActionRecord {
  return {
    timestamp: Date.now(),
    gameTime,
    type,
    vehicleId,
    lampId,
    details,
    scoreChange,
  };
}

export function getScoreItemLabel(type: string): string {
  const labels: Record<string, string> = {
    baseScore: '基础得分',
    priorityBonus: '优先级奖励',
    timeBonus: '提前完成奖励',
    errorPenalty: '错误操作扣分',
    timeoutPenalty: '超时扣分',
    wastePenalty: '资源浪费扣分',
    routeCostPenalty: '路线成本扣分',
  };
  return labels[type] || type;
}

export function getScoreItemColor(type: string, isPositive: boolean): string {
  if (isPositive) {
    if (type === 'baseScore') return 'text-emerald-400';
    if (type === 'priorityBonus') return 'text-amber-400';
    if (type === 'timeBonus') return 'text-sky-400';
  } else {
    if (type === 'errorPenalty') return 'text-orange-400';
    if (type === 'timeoutPenalty') return 'text-red-400';
    if (type === 'wastePenalty') return 'text-yellow-400';
    if (type === 'routeCostPenalty') return 'text-purple-400';
  }
  return 'text-gray-400';
}
