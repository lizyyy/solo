import { ScoreBreakdown, Stall, GameEvent } from '@/types/game';
import { calculateTotalElectricity, calculateTotalSmoke } from './simulation';

export interface ScoringContext {
  stalls: Stall[];
  maxElectricity: number;
  idealElectricity: number;
  maxSmoke: number;
  complaints: number;
  maxComplaints: number;
  money: number;
  targetMoney: number;
  totalRounds: number;
  completedRounds: number;
  events: GameEvent[];
  errorCount: number;
  timeoutCount: number;
  wasteCount: number;
}

export function calculateEfficiencyScore(ctx: ScoringContext): number {
  const total = calculateTotalElectricity(ctx.stalls);
  const diff = Math.abs(total - ctx.idealElectricity);
  const ratio = diff / ctx.idealElectricity;
  return Math.max(0, Math.round((1 - Math.min(ratio, 1)) * 30));
}

export function calculateComplianceScore(ctx: ScoringContext): number {
  const complaintRatio = ctx.complaints / ctx.maxComplaints;
  const complaintScore = (1 - Math.min(complaintRatio, 1)) * 30;

  const totalSmoke = calculateTotalSmoke(ctx.stalls);
  const smokeRatio = totalSmoke / ctx.maxSmoke;
  const smokeScore = (1 - Math.min(smokeRatio, 1)) * 20;

  return Math.max(0, Math.round(complaintScore + smokeScore));
}

export function calculateProfitScore(ctx: ScoringContext): number {
  const ratio = ctx.money / ctx.targetMoney;
  return Math.max(0, Math.round(Math.min(ratio, 1) * 20));
}

export function calculatePenaltyScore(ctx: ScoringContext): number {
  const errorPenalty = ctx.errorCount * 2;
  const timeoutPenalty = ctx.timeoutCount * 5;
  const wastePenalty = ctx.wasteCount * 3;
  return errorPenalty + timeoutPenalty + wastePenalty;
}

export function calculateTotalScore(ctx: ScoringContext): ScoreBreakdown {
  const efficiency = calculateEfficiencyScore(ctx);
  const compliance = calculateComplianceScore(ctx);
  const profit = calculateProfitScore(ctx);
  const penalty = calculatePenaltyScore(ctx);
  const total = Math.max(0, efficiency + compliance + profit - penalty);

  return {
    efficiency,
    compliance,
    profit,
    penalty,
    total,
  };
}

export function getScoreGrade(score: number): { grade: string; color: string; description: string } {
  if (score >= 85) {
    return { grade: 'S', color: '#FFD23F', description: '完美经营！所有规则掌握到位' };
  }
  if (score >= 70) {
    return { grade: 'A', color: '#2EC4B6', description: '优秀！合规经营，值得表扬' };
  }
  if (score >= 55) {
    return { grade: 'B', color: '#FFD23F', description: '良好，有小改进空间' };
  }
  if (score >= 40) {
    return { grade: 'C', color: '#FF6B35', description: '及格，需注意规则遵守' };
  }
  return { grade: 'D', color: '#E63946', description: '不及格，需加强规则学习' };
}

export function explainScore(breakdown: ScoreBreakdown): string[] {
  const explanations: string[] = [];

  explanations.push(`用电效率：${breakdown.efficiency}/30 分`);
  if (breakdown.efficiency >= 25) {
    explanations.push('✓ 用电效率优秀，容量利用合理');
  } else if (breakdown.efficiency >= 15) {
    explanations.push('△ 用电效率一般，可优化功率分配');
  } else {
    explanations.push('✗ 用电效率差，建议调整各摊位功率');
  }

  explanations.push(`合规经营：${breakdown.compliance}/50 分`);
  if (breakdown.compliance >= 40) {
    explanations.push('✓ 合规经营优秀，油烟和投诉控制良好');
  } else if (breakdown.compliance >= 25) {
    explanations.push('△ 合规经营一般，注意油烟排放');
  } else {
    explanations.push('✗ 合规经营差，油烟或投诉问题严重');
  }

  explanations.push(`经营收益：${breakdown.profit}/20 分`);
  if (breakdown.profit >= 15) {
    explanations.push('✓ 经营收益达标');
  } else if (breakdown.profit >= 10) {
    explanations.push('△ 经营收益一般');
  } else {
    explanations.push('✗ 经营收益不足，摊位开启率偏低');
  }

  if (breakdown.penalty > 0) {
    explanations.push(`违规扣分：-${breakdown.penalty} 分`);
    explanations.push(`  - 错误操作扣 ${breakdown.penalty > 0 ? '每错误操作扣2分' : ''}`);
    explanations.push(`  - 超时操作扣 ${breakdown.penalty > 0 ? '每超时扣5分' : ''}`);
    explanations.push(`  - 资源浪费扣 ${breakdown.penalty > 0 ? '每浪费扣3分' : ''}`);
  }

  return explanations;
}