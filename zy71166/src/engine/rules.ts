import type { Rack, ACUnit, TurnState, GameEvent } from './types';
import { PHYSICS_CONFIG, SCORE_CONFIG } from './config';

const {
  FAULT_TEMP,
  OVERLOAD_THRESHOLD,
  WARNING_TEMP,
} = PHYSICS_CONFIG;

const {
  SURVIVAL_BONUS,
  TEMP_BONUS_PER_DEGREE,
  TEMP_BONUS_THRESHOLD,
  COST_PENALTY_RATE,
  WARNING_PENALTY,
  BALANCE_BONUS_MAX,
} = SCORE_CONFIG;

export interface RuleCheckResult {
  gameOver: boolean;
  failReason: string | null;
  events: GameEvent[];
}

export function checkFailureConditions(
  racks: Rack[],
  acUnits: ACUnit[],
  turnState: TurnState,
): RuleCheckResult {
  const events: GameEvent[] = [];
  let gameOver = false;
  let failReason: string | null = null;

  for (const rack of racks) {
    if (rack.status === 'fault') {
      gameOver = true;
      failReason = `机柜 ${rack.name} 温度过高（${rack.temperature.toFixed(1)}°C），设备已宕机！`;
      events.push({
        id: `evt-${Date.now()}-${rack.id}`,
        turn: turnState.turn,
        hour: turnState.hour,
        type: 'hotspot',
        message: `机柜 ${rack.name} 温度超过 ${FAULT_TEMP}°C，发生硬件故障！`,
        severity: 'danger',
        timestamp: Date.now(),
      });
      return { gameOver, failReason, events };
    }

    if (rack.status === 'danger') {
      events.push({
        id: `evt-${Date.now()}-${rack.id}-danger`,
        turn: turnState.turn,
        hour: turnState.hour,
        type: 'hotspot',
        message: `警告：机柜 ${rack.name} 温度达到危险值 ${rack.temperature.toFixed(1)}°C！`,
        severity: 'danger',
        timestamp: Date.now(),
      });
    } else if (rack.status === 'warning') {
      events.push({
        id: `evt-${Date.now()}-${rack.id}-warn`,
        turn: turnState.turn,
        hour: turnState.hour,
        type: 'hotspot',
        message: `注意：机柜 ${rack.name} 温度偏高 ${rack.temperature.toFixed(1)}°C`,
        severity: 'warning',
        timestamp: Date.now(),
      });
    }
  }

  for (const ac of acUnits) {
    if (ac.status === 'overload') {
      events.push({
        id: `evt-${Date.now()}-${ac.id}`,
        turn: turnState.turn,
        hour: turnState.hour,
        type: 'ac_overload',
        message: `空调 ${ac.name} 运行负载超过 ${Math.round(OVERLOAD_THRESHOLD * 100)}%，存在跳闸风险！`,
        severity: 'warning',
        timestamp: Date.now(),
      });
    }
  }

  const totalCapacity = acUnits.filter((a) => a.isOn && a.status !== 'fault').reduce((s, a) => s + a.capacity, 0);
  const totalLoad = racks.reduce((s, r) => s + r.load, 0) * 0.8;
  if (totalCapacity > 0 && totalLoad > totalCapacity * OVERLOAD_THRESHOLD) {
    gameOver = true;
    failReason = '总制冷需求超过空调额定容量的120%，系统过载跳闸！';
    events.push({
      id: `evt-${Date.now()}-overload`,
      turn: turnState.turn,
      hour: turnState.hour,
      type: 'ac_overload',
      message: failReason,
      severity: 'danger',
      timestamp: Date.now(),
    });
    return { gameOver, failReason, events };
  }

  if (turnState.totalCost > turnState.budget * 3) {
    gameOver = true;
    failReason = `累计电费（${turnState.totalCost.toFixed(2)}元）已超过预算的300%！`;
    events.push({
      id: `evt-${Date.now()}-cost`,
      turn: turnState.turn,
      hour: turnState.hour,
      type: 'cost_exceed',
      message: failReason,
      severity: 'danger',
      timestamp: Date.now(),
    });
    return { gameOver, failReason, events };
  }

  return { gameOver, failReason, events };
}

export function calculateTurnScore(
  racks: Rack[],
  turnState: TurnState,
  electricityUsed: number,
): { scoreDelta: number; details: Record<string, number> } {
  const details: Record<string, number> = {};

  details.survival = SURVIVAL_BONUS;

  const avgTemp = racks.reduce((s, r) => s + r.temperature, 0) / racks.length;
  const tempBonus = Math.max(0, (TEMP_BONUS_THRESHOLD - avgTemp) * TEMP_BONUS_PER_DEGREE);
  details.tempBonus = Math.round(tempBonus);

  const turnCost = electricityUsed * turnState.electricityPrice;
  const costPenalty = turnCost * COST_PENALTY_RATE;
  details.costPenalty = -Math.round(costPenalty);

  const warningCount = racks.filter((r) => r.status === 'warning' || r.status === 'danger').length;
  const warningPenalty = warningCount * WARNING_PENALTY;
  details.warningPenalty = -warningPenalty;

  const loads = racks.map((r) => r.load / r.maxLoad);
  const avgLoad = loads.reduce((s, l) => s + l, 0) / loads.length;
  const variance = loads.reduce((s, l) => s + Math.pow(l - avgLoad, 2), 0) / loads.length;
  const stdDev = Math.sqrt(variance);
  const balanceBonus = Math.max(0, BALANCE_BONUS_MAX * (1 - stdDev * 2));
  details.balanceBonus = Math.round(balanceBonus);

  const scoreDelta = Object.values(details).reduce((s, v) => s + v, 0);

  return { scoreDelta: Math.round(scoreDelta), details };
}

export function getFinalEvaluation(
  finalScore: number,
  totalTurns: number,
  completedTurns: number,
  racks: Rack[],
  totalCost: number,
  budget: number,
): {
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  comments: string[];
  stats: Record<string, string | number>;
} {
  const avgTemp = racks.reduce((s, r) => s + r.temperature, 0) / racks.length;
  const maxTemp = Math.max(...racks.map((r) => r.temperature));
  const costRatio = totalCost / budget;
  const completionRate = completedTurns / totalTurns;

  const stats: Record<string, string | number> = {
    '最终得分': finalScore,
    '完成回合': `${completedTurns}/${totalTurns}`,
    '平均温度': `${avgTemp.toFixed(1)}°C`,
    '最高温度': `${maxTemp.toFixed(1)}°C`,
    '累计电费': `${totalCost.toFixed(2)}元`,
    '预算使用率': `${(costRatio * 100).toFixed(1)}%`,
  };

  const comments: string[] = [];

  if (completionRate < 1) {
    comments.push('挑战未完成，继续加油！');
  } else if (avgTemp < 27) {
    comments.push('温度控制优秀！机房运行非常稳定。');
  } else if (avgTemp < 30) {
    comments.push('温度控制良好，运行状态稳定。');
  } else if (avgTemp < WARNING_TEMP) {
    comments.push('温度控制尚可，有优化空间。');
  } else {
    comments.push('温度偏高，需要加强冷却管理。');
  }

  if (costRatio < 0.7) {
    comments.push('成本控制非常出色！');
  } else if (costRatio < 1) {
    comments.push('成本控制在预算范围内。');
  } else if (costRatio < 1.5) {
    comments.push('成本略超预算，注意电价优化。');
  } else {
    comments.push('成本超支严重，需要优化运行策略。');
  }

  let grade: 'S' | 'A' | 'B' | 'C' | 'D';
  if (completionRate === 1 && finalScore >= 3500 && costRatio < 0.8) {
    grade = 'S';
  } else if (completionRate >= 0.9 && finalScore >= 2500) {
    grade = 'A';
  } else if (completionRate >= 0.7 && finalScore >= 1500) {
    grade = 'B';
  } else if (completionRate >= 0.5 && finalScore >= 500) {
    grade = 'C';
  } else {
    grade = 'D';
  }

  return { grade, comments, stats };
}
