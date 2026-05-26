import type { ActionRecord, ErrorRecord, ScoreBreakdown, GameSession } from './types';

export const SCORE_CONFIG = {
  correctPrep: 10,
  correctPickup: 15,
  comboBonus: 20,
  comboThreshold: 5,
  penalties: {
    allergenMismatch: 100,
    wrongGrade: 50,
    pickupTimeout: 30,
    windowCongestion: 20,
    foodWaste: 15,
  },
};

export function calculateComboBonus(combo: number): number {
  if (combo > 0 && combo % SCORE_CONFIG.comboThreshold === 0) {
    return SCORE_CONFIG.comboBonus;
  }
  return 0;
}

export function calculateScoreBreakdown(session: GameSession): ScoreBreakdown {
  const totalOrders = session.correctCount + session.errorCount;
  if (totalOrders === 0) {
    return { prepAccuracy: 100, pickupTimeliness: 100, allergenAvoidance: 100, wasteRatio: 100 };
  }

  const prepAccuracy = Math.max(0, ((session.correctCount - session.allergenMismatches) / totalOrders) * 100);
  const pickupTimeliness = Math.max(0, ((session.correctCount - session.pickupTimeouts) / totalOrders) * 100);
  const allergenAvoidance = session.allergenMismatches > 0
    ? Math.max(0, 100 - (session.allergenMismatches / totalOrders) * 100)
    : 100;
  const wasteRatio = session.wastes > 0
    ? Math.max(0, 100 - (session.wastes / totalOrders) * 100)
    : 100;

  return { prepAccuracy, pickupTimeliness, allergenAvoidance, wasteRatio };
}

export function determineResult(session: GameSession, targetScore: number): 'win' | 'lose' {
  return session.totalScore >= targetScore ? 'win' : 'lose';
}

export function generateErrorRecord(
  sessionId: string,
  errorType: ErrorRecord['errorType'],
  description: string,
  gameTime: number
): ErrorRecord {
  const penalties: Record<ErrorRecord['errorType'], number> = {
    allergen_mismatch: SCORE_CONFIG.penalties.allergenMismatch,
    wrong_grade: SCORE_CONFIG.penalties.wrongGrade,
    pickup_timeout: SCORE_CONFIG.penalties.pickupTimeout,
    window_congestion: SCORE_CONFIG.penalties.windowCongestion,
    food_waste: SCORE_CONFIG.penalties.foodWaste,
  };

  return {
    id: `error_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    errorType,
    description,
    penaltyScore: penalties[errorType],
    timestamp: Date.now(),
    gameTime,
  };
}

export function generateActionRecord(
  sessionId: string,
  type: ActionRecord['type'],
  gameTime: number,
  options: Partial<ActionRecord> = {}
): ActionRecord {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    type,
    timestamp: Date.now(),
    gameTime,
    success: true,
    ...options,
  };
}

export function getErrorLabel(errorType: ErrorRecord['errorType']): string {
  const labels: Record<ErrorRecord['errorType'], string> = {
    allergen_mismatch: '过敏餐错配',
    wrong_grade: '年级错配',
    pickup_timeout: '取餐超时',
    window_congestion: '窗口拥堵',
    food_waste: '备餐浪费',
  };
  return labels[errorType];
}