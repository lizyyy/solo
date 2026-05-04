const { normalizeUnit, UNIT_CONVERSIONS, APPLE_HEALTH_TYPE_NAMES } = require('../units');

describe('Unit Utils', () => {
  describe('UNIT_CONVERSIONS', () => {
    test('should have energy conversions defined', () => {
      expect(UNIT_CONVERSIONS.energy).toBeDefined();
      expect(UNIT_CONVERSIONS.energy.kcal).toBe(1);
      expect(UNIT_CONVERSIONS.energy.kilocalorie).toBe(1);
    });

    test('should have distance conversions defined', () => {
      expect(UNIT_CONVERSIONS.distance).toBeDefined();
      expect(UNIT_CONVERSIONS.distance.km).toBe(1);
      expect(UNIT_CONVERSIONS.distance.mi).toBeCloseTo(1.60934, 2);
    });

    test('should have time conversions defined', () => {
      expect(UNIT_CONVERSIONS.time).toBeDefined();
      expect(UNIT_CONVERSIONS.time.min).toBe(1);
      expect(UNIT_CONVERSIONS.time.hr).toBe(60);
    });
  });

  describe('normalizeUnit', () => {
    test('should normalize energy units to kcal', () => {
      expect(normalizeUnit(100, 'kcal', 'energy')).toBe(100);
      expect(normalizeUnit(100, 'cal', 'energy')).toBe(0.1);
    });

    test('should normalize distance units to km', () => {
      expect(normalizeUnit(5, 'km', 'distance')).toBe(5);
      expect(normalizeUnit(1, 'mi', 'distance')).toBeCloseTo(1.60934, 2);
      expect(normalizeUnit(1000, 'm', 'distance')).toBe(1);
    });

    test('should normalize time units to minutes', () => {
      expect(normalizeUnit(30, 'min', 'time')).toBe(30);
      expect(normalizeUnit(2, 'hr', 'time')).toBe(120);
    });

    test('should return original value for unknown category', () => {
      expect(normalizeUnit(100, 'unknown', 'unknown')).toBe(100);
    });

    test('should return original value for unknown unit', () => {
      expect(normalizeUnit(100, 'unknown', 'energy')).toBe(100);
    });
  });

  describe('APPLE_HEALTH_TYPE_NAMES', () => {
    test('should have common health types mapped to Chinese', () => {
      expect(APPLE_HEALTH_TYPE_NAMES['HKQuantityTypeIdentifierStepCount']).toBe('步数');
      expect(APPLE_HEALTH_TYPE_NAMES['HKQuantityTypeIdentifierHeartRate']).toBe('心率');
      expect(APPLE_HEALTH_TYPE_NAMES['HKQuantityTypeIdentifierRestingHeartRate']).toBe('静息心率');
      expect(APPLE_HEALTH_TYPE_NAMES['HKQuantityTypeIdentifierHeartRateVariabilitySDNN']).toBe('心率变异性');
      expect(APPLE_HEALTH_TYPE_NAMES['HKCategoryTypeIdentifierSleepAnalysis']).toBe('睡眠分析');
      expect(APPLE_HEALTH_TYPE_NAMES['HKQuantityTypeIdentifierActiveEnergyBurned']).toBe('活动能量');
      expect(APPLE_HEALTH_TYPE_NAMES['HKQuantityTypeIdentifierDistanceWalkingRunning']).toBe('步行+跑步距离');
    });

    test('should return undefined for unknown type', () => {
      expect(APPLE_HEALTH_TYPE_NAMES['UnknownType']).toBeUndefined();
    });
  });
});
