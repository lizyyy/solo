import {
  calculateSettlementAmount,
  calculateSettlementSummary,
  determineSettlementStatus,
  DEFAULT_SETTLEMENT_CONFIG
} from '../src/core/settlementCalculator';
import { DeviationResult, SettlementStatus } from '../src/types';

describe('Settlement Calculator', () => {
  const createDeviationResult = (
    achieved: number,
    expected: number,
    passed: boolean
  ): DeviationResult => ({
    enrollmentId: 'test-enrollment',
    averageBaseline: 100,
    averageActual: 100 - achieved,
    achievedReduction: achieved,
    expectedReduction: expected,
    deviationRate: expected > 0 ? achieved / expected : 0,
    passThreshold: 0.8,
    isPassed: passed,
    calculatedAt: new Date()
  });

  describe('calculateSettlementAmount', () => {
    it('should calculate settlement for 100% achievement', () => {
      const deviation = createDeviationResult(20, 20, true);
      const unitPrice = 100;

      const result = calculateSettlementAmount({
        enrollmentId: 'test-1',
        batchId: 'batch-1',
        enterpriseId: 'enterprise-1',
        deviationResult: deviation,
        unitPrice
      });

      expect(result.success).toBe(true);
      expect(result.data?.settlementAmount).toBe(20 * 100);
      expect(result.data?.reductionAmount).toBe(20);
      expect(result.data?.deviationRate).toBe(1);
    });

    it('should apply bonus for over-achievement', () => {
      const deviation = createDeviationResult(25, 20, true);
      const unitPrice = 100;

      const result = calculateSettlementAmount({
        enrollmentId: 'test-1',
        batchId: 'batch-1',
        enterpriseId: 'enterprise-1',
        deviationResult: deviation,
        unitPrice,
        config: {
          ...DEFAULT_SETTLEMENT_CONFIG,
          bonusMultiplier: 1.5
        }
      });

      expect(result.success).toBe(true);
      const base = 25 * 100;
      const bonus = (25 / 20 - 1) * 25 * 100 * 1.5;
      expect(result.data?.settlementAmount).toBe(base + bonus);
    });

    it('should pay full amount when passed (even with deviation < 1 but >= threshold)', () => {
      const deviation = createDeviationResult(18, 20, true);
      const unitPrice = 100;

      const result = calculateSettlementAmount({
        enrollmentId: 'test-1',
        batchId: 'batch-1',
        enterpriseId: 'enterprise-1',
        deviationResult: deviation,
        unitPrice,
        config: {
          ...DEFAULT_SETTLEMENT_CONFIG,
          penaltyMultiplier: 2
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.settlementAmount).toBe(18 * 100);
    });

    it('should apply significant penalty for failing achievement', () => {
      const deviation = createDeviationResult(10, 20, false);
      const unitPrice = 100;

      const result = calculateSettlementAmount({
        enrollmentId: 'test-1',
        batchId: 'batch-1',
        enterpriseId: 'enterprise-1',
        deviationResult: deviation,
        unitPrice
      });

      expect(result.success).toBe(true);
      expect(result.data?.settlementAmount).toBeLessThan(10 * 100);
    });

    it('should return error for invalid unit price', () => {
      const deviation = createDeviationResult(20, 20, true);
      const result = calculateSettlementAmount({
        enrollmentId: 'test-1',
        batchId: 'batch-1',
        enterpriseId: 'enterprise-1',
        deviationResult: deviation,
        unitPrice: 0
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_UNIT_PRICE');
    });

    it('should round to 2 decimal places', () => {
      const deviation = createDeviationResult(20.5, 20, true);
      const unitPrice = 99.99;

      const result = calculateSettlementAmount({
        enrollmentId: 'test-1',
        batchId: 'batch-1',
        enterpriseId: 'enterprise-1',
        deviationResult: deviation,
        unitPrice
      });

      expect(result.success).toBe(true);
      const amount = result.data?.settlementAmount || 0;
      expect(Math.round(amount * 100) / 100).toBe(amount);
    });
  });

  describe('determineSettlementStatus', () => {
    it('should return FAILED when there are settlement errors', () => {
      const deviation = createDeviationResult(20, 20, true);
      const status = determineSettlementStatus(deviation, true);
      expect(status).toBe(SettlementStatus.FAILED);
    });

    it('should return COMPLETED when passed without errors', () => {
      const deviation = createDeviationResult(20, 20, true);
      const status = determineSettlementStatus(deviation, false);
      expect(status).toBe(SettlementStatus.COMPLETED);
    });

    it('should return PENDING when not passed', () => {
      const deviation = createDeviationResult(10, 20, false);
      const status = determineSettlementStatus(deviation, false);
      expect(status).toBe(SettlementStatus.PENDING);
    });
  });

  describe('calculateSettlementSummary', () => {
    it('should calculate summary for multiple results', () => {
      const results = [
        {
          deviationResult: createDeviationResult(20, 20, true),
          settlementAmount: 2000,
          reductionAmount: 20
        },
        {
          deviationResult: createDeviationResult(15, 20, false),
          settlementAmount: 1000,
          reductionAmount: 15
        }
      ];

      const summary = calculateSettlementSummary(results);

      expect(summary.totalEnrollments).toBe(2);
      expect(summary.passedEnrollments).toBe(1);
      expect(summary.failedEnrollments).toBe(1);
      expect(summary.totalSettlementAmount).toBe(3000);
      expect(summary.totalReductionAmount).toBe(35);
      expect(summary.averageDeviationRate).toBe((1 + 0.75) / 2);
    });

    it('should handle empty results', () => {
      const summary = calculateSettlementSummary([]);

      expect(summary.totalEnrollments).toBe(0);
      expect(summary.passedEnrollments).toBe(0);
      expect(summary.failedEnrollments).toBe(0);
      expect(summary.totalSettlementAmount).toBe(0);
      expect(summary.totalReductionAmount).toBe(0);
      expect(summary.averageDeviationRate).toBe(0);
    });

    it('should round summary values correctly', () => {
      const results = [
        {
          deviationResult: createDeviationResult(10.333, 10, true),
          settlementAmount: 1033.333,
          reductionAmount: 10.333
        }
      ];

      const summary = calculateSettlementSummary(results);

      expect(summary.totalSettlementAmount).toBe(1033.33);
      expect(summary.totalReductionAmount).toBe(10.33);
    });
  });
});
