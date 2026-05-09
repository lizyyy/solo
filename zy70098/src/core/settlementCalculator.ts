import { DeviationResult, OperationResult, SettlementStatus } from '../types';

export interface SettlementCalculationConfig {
  minimumPayout: number;
  penaltyMultiplier: number;
  bonusMultiplier: number;
}

export const DEFAULT_SETTLEMENT_CONFIG: SettlementCalculationConfig = {
  minimumPayout: 0,
  penaltyMultiplier: 1,
  bonusMultiplier: 1
};

export interface SettlementInput {
  enrollmentId: string;
  batchId: string;
  enterpriseId: string;
  deviationResult: DeviationResult;
  unitPrice: number;
  config?: SettlementCalculationConfig;
}

export function calculateSettlementAmount(
  input: SettlementInput
): OperationResult<{
  settlementAmount: number;
  reductionAmount: number;
  deviationRate: number;
}> {
  const config = { ...DEFAULT_SETTLEMENT_CONFIG, ...input.config };

  if (input.unitPrice <= 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_UNIT_PRICE',
        message: '单位价格必须大于 0',
        details: { unitPrice: input.unitPrice }
      }
    };
  }

  const { achievedReduction, deviationRate, isPassed } = input.deviationResult;

  if (achievedReduction < 0) {
    return {
      success: false,
      error: {
        code: 'NEGATIVE_REDUCTION',
        message: '削减量不能为负数',
        details: { achievedReduction }
      }
    };
  }

  let settlementAmount = 0;

  if (isPassed) {
    settlementAmount = achievedReduction * input.unitPrice;

    if (deviationRate > 1) {
      const bonus = (deviationRate - 1) * achievedReduction * input.unitPrice * config.bonusMultiplier;
      settlementAmount += bonus;
    }
  } else {
    const penalty = achievedReduction * input.unitPrice * (1 - deviationRate) * config.penaltyMultiplier;
    settlementAmount = Math.max(0, achievedReduction * input.unitPrice - penalty);
  }

  if (settlementAmount < config.minimumPayout && achievedReduction > 0) {
    settlementAmount = config.minimumPayout;
  }

  settlementAmount = Math.round(settlementAmount * 100) / 100;

  return {
    success: true,
    data: {
      settlementAmount,
      reductionAmount: achievedReduction,
      deviationRate
    }
  };
}

export function determineSettlementStatus(
  deviationResult: DeviationResult,
  hasSettlementErrors: boolean
): SettlementStatus {
  if (hasSettlementErrors) {
    return SettlementStatus.FAILED;
  }

  if (deviationResult.isPassed) {
    return SettlementStatus.COMPLETED;
  }

  return SettlementStatus.PENDING;
}

export interface SettlementSummary {
  totalEnrollments: number;
  passedEnrollments: number;
  failedEnrollments: number;
  totalSettlementAmount: number;
  totalReductionAmount: number;
  averageDeviationRate: number;
}

export function calculateSettlementSummary(
  results: Array<{
    deviationResult: DeviationResult;
    settlementAmount: number;
    reductionAmount: number;
  }>
): SettlementSummary {
  if (results.length === 0) {
    return {
      totalEnrollments: 0,
      passedEnrollments: 0,
      failedEnrollments: 0,
      totalSettlementAmount: 0,
      totalReductionAmount: 0,
      averageDeviationRate: 0
    };
  }

  const totalEnrollments = results.length;
  const passedEnrollments = results.filter(r => r.deviationResult.isPassed).length;
  const failedEnrollments = totalEnrollments - passedEnrollments;
  const totalSettlementAmount = results.reduce((sum, r) => sum + r.settlementAmount, 0);
  const totalReductionAmount = results.reduce((sum, r) => sum + r.reductionAmount, 0);
  const averageDeviationRate =
    results.reduce((sum, r) => sum + r.deviationResult.deviationRate, 0) / totalEnrollments;

  return {
    totalEnrollments,
    passedEnrollments,
    failedEnrollments,
    totalSettlementAmount: Math.round(totalSettlementAmount * 100) / 100,
    totalReductionAmount: Math.round(totalReductionAmount * 100) / 100,
    averageDeviationRate: parseFloat(averageDeviationRate.toFixed(4))
  };
}
