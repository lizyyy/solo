import type { ScoreDetail, ScoreDetailType } from '../types';

export const SCORE_RULES: Record<ScoreDetailType, { points: number; description: string }> = {
  correct: { points: 10, description: '正确顺序巡检' },
  full_completion: { points: 50, description: '完成全流程' },
  wrong_order: { points: -15, description: '顺序错误' },
  skipped: { points: -20, description: '漏检项目' },
  duplicate: { points: -10, description: '重复记录' },
  anomaly_unhandled: { points: -25, description: '异常未处理' },
  anomaly_not_upgraded: { points: -30, description: '异常未升级' },
  timeout: { points: -5, description: '超时' },
  report_complete: { points: 30, description: '报告完整' },
};

export function generateScoreId(): string {
  return `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createScoreDetail(
  type: ScoreDetailType,
  customDescription?: string
): ScoreDetail {
  const rule = SCORE_RULES[type];
  return {
    id: generateScoreId(),
    type,
    description: customDescription || rule.description,
    points: rule.points,
    timestamp: Date.now(),
  };
}

export function getScoreBreakdown(scoreDetails: ScoreDetail[]) {
  const breakdown: Record<string, { total: number; count: number; details: ScoreDetail[] }> = {};

  scoreDetails.forEach(detail => {
    const type = detail.type;
    if (!breakdown[type]) {
      breakdown[type] = { total: 0, count: 0, details: [] };
    }
    breakdown[type].total += detail.points;
    breakdown[type].count += 1;
    breakdown[type].details.push(detail);
  });

  return breakdown;
}

export function calculateTimeoutPenalty(seconds: number): ScoreDetail {
  return {
    id: generateScoreId(),
    type: 'timeout',
    description: `超时 ${seconds} 秒`,
    points: SCORE_RULES.timeout.points * seconds,
    timestamp: Date.now(),
  };
}
