import {
  calculateDeviation,
  calculateAverage,
  validateExecutionRecords,
  DEFAULT_DEVIATION_CONFIG
} from '../src/core/deviationCalculator';
import { ExecutionRecord } from '../src/types';
import { v4 as uuidv4 } from 'uuid';

describe('Deviation Calculator', () => {
  const createExecutionRecord = (
    baseline: number,
    actual: number,
    timestamp: Date = new Date()
  ): ExecutionRecord => ({
    id: uuidv4(),
    batchId: 'batch-1',
    enrollmentId: 'enrollment-1',
    enterpriseId: 'enterprise-1',
    timestamp,
    baselineLoad: baseline,
    actualLoad: actual,
    sourceSystem: 'meter',
    createdAt: new Date(),
    version: 1
  });

  describe('calculateAverage', () => {
    it('should calculate average of positive numbers', () => {
      expect(calculateAverage([10, 20, 30])).toBe(20);
    });

    it('should return 0 for empty array', () => {
      expect(calculateAverage([])).toBe(0);
    });

    it('should handle single value', () => {
      expect(calculateAverage([42])).toBe(42);
    });
  });

  describe('calculateDeviation', () => {
    it('should calculate deviation with 100% achievement', () => {
      const records = [
        createExecutionRecord(100, 80),
        createExecutionRecord(100, 80),
        createExecutionRecord(100, 80)
      ];
      const declaredCapacity = 20;

      const result = calculateDeviation(records, declaredCapacity);
      expect(result.success).toBe(true);
      expect(result.data?.deviationRate).toBe(1);
      expect(result.data?.isPassed).toBe(true);
      expect(result.data?.achievedReduction).toBe(20);
      expect(result.data?.expectedReduction).toBe(20);
    });

    it('should calculate deviation with 90% achievement (passed)', () => {
      const records = [
        createExecutionRecord(100, 82)
      ];
      const declaredCapacity = 20;

      const result = calculateDeviation(records, declaredCapacity);
      expect(result.success).toBe(true);
      expect(result.data?.deviationRate).toBe(0.9);
      expect(result.data?.isPassed).toBe(true);
      expect(result.data?.achievedReduction).toBe(18);
    });

    it('should calculate deviation with 70% achievement (failed)', () => {
      const records = [
        createExecutionRecord(100, 86)
      ];
      const declaredCapacity = 20;

      const result = calculateDeviation(records, declaredCapacity);
      expect(result.success).toBe(true);
      expect(result.data?.deviationRate).toBe(0.7);
      expect(result.data?.isPassed).toBe(false);
    });

    it('should handle over-achievement (deviation > 1)', () => {
      const records = [
        createExecutionRecord(100, 75)
      ];
      const declaredCapacity = 20;

      const result = calculateDeviation(records, declaredCapacity);
      expect(result.success).toBe(true);
      expect(result.data?.deviationRate).toBe(1.25);
      expect(result.data?.isPassed).toBe(true);
    });

    it('should return error for no execution records', () => {
      const result = calculateDeviation([], 20);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_EXECUTION_RECORDS');
    });

    it('should return error for invalid declared capacity', () => {
      const records = [createExecutionRecord(100, 80)];
      const result = calculateDeviation(records, 0);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DECLARED_CAPACITY');
    });

    it('should use custom pass threshold', () => {
      const records = [createExecutionRecord(100, 85)];
      const declaredCapacity = 20;

      const result = calculateDeviation(records, declaredCapacity, {
        ...DEFAULT_DEVIATION_CONFIG,
        passThreshold: 0.7
      });
      expect(result.success).toBe(true);
      expect(result.data?.deviationRate).toBe(0.75);
      expect(result.data?.isPassed).toBe(true);
    });

    it('should not allow negative reduction', () => {
      const records = [createExecutionRecord(100, 110)];
      const declaredCapacity = 20;

      const result = calculateDeviation(records, declaredCapacity);
      expect(result.success).toBe(true);
      expect(result.data?.achievedReduction).toBe(0);
      expect(result.data?.deviationRate).toBe(0);
      expect(result.data?.isPassed).toBe(false);
    });
  });

  describe('validateExecutionRecords', () => {
    const batchStartTime = new Date('2024-01-01T10:00:00');
    const batchEndTime = new Date('2024-01-01T12:00:00');

    it('should validate records within time range', () => {
      const records = [
        createExecutionRecord(100, 80, new Date('2024-01-01T10:30:00')),
        createExecutionRecord(100, 80, new Date('2024-01-01T11:30:00'))
      ];

      const result = validateExecutionRecords(records, batchStartTime, batchEndTime);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    it('should warn about records outside time range', () => {
      const records = [
        createExecutionRecord(100, 80, new Date('2024-01-01T09:30:00')),
        createExecutionRecord(100, 80, new Date('2024-01-01T10:30:00'))
      ];

      const result = validateExecutionRecords(records, batchStartTime, batchEndTime);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(1);
    });

    it('should error on negative load values', () => {
      const records = [
        createExecutionRecord(100, -10, new Date('2024-01-01T10:30:00'))
      ];

      const result = validateExecutionRecords(records, batchStartTime, batchEndTime);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
    });

    it('should warn when actual load is higher than baseline', () => {
      const records = [
        createExecutionRecord(100, 120, new Date('2024-01-01T10:30:00'))
      ];

      const result = validateExecutionRecords(records, batchStartTime, batchEndTime);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(1);
    });

    it('should error when no records provided', () => {
      const result = validateExecutionRecords([], batchStartTime, batchEndTime);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
    });
  });
});
