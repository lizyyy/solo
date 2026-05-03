const riskRules = require('../src/core/riskRules');
const metrics = require('../src/core/metrics');

describe('RiskRules', () => {
  describe('cleanAnomalousLocations', () => {
    test('should detect low accuracy GPS points', () => {
      const bikeGPS = [
        { bike_id: 'BK001', timestamp: Date.now(), latitude: 31.2354, longitude: 121.4787, accuracy: 10 },
        { bike_id: 'BK002', timestamp: Date.now(), latitude: 31.2356, longitude: 121.4789, accuracy: 60 }
      ];

      const result = riskRules.cleanAnomalousLocations(bikeGPS);
      
      expect(result.stats.total).toBe(2);
      expect(result.stats.anomalies).toBe(1);
      expect(result.cleaned.length).toBe(1);
      expect(result.anomalies[0].anomaly_types).toContain('LOW_ACCURACY');
    });

    test('should detect null island coordinates (0,0)', () => {
      const bikeGPS = [
        { bike_id: 'BK001', timestamp: Date.now(), latitude: 31.2354, longitude: 121.4787, accuracy: 10 },
        { bike_id: 'BK002', timestamp: Date.now(), latitude: 0, longitude: 0, accuracy: 10 }
      ];

      const result = riskRules.cleanAnomalousLocations(bikeGPS);
      
      expect(result.stats.anomalies).toBe(1);
      expect(result.anomalies[0].anomaly_types).toContain('NULL_ISLAND');
    });

    test('should detect invalid coordinates', () => {
      const bikeGPS = [
        { bike_id: 'BK001', timestamp: Date.now(), latitude: 95, longitude: 121.4787, accuracy: 10 },
        { bike_id: 'BK002', timestamp: Date.now(), latitude: 31.2356, longitude: 200, accuracy: 10 }
      ];

      const result = riskRules.cleanAnomalousLocations(bikeGPS);
      
      expect(result.stats.anomalies).toBe(2);
      expect(result.anomalies[0].anomaly_types).toContain('INVALID_COORDINATES');
    });
  });

  describe('assessStationRisk', () => {
    test('should assess critical overflow risk', () => {
      const station = {
        station_id: 'ST001',
        name: '测试站点',
        latitude: 31.2355,
        longitude: 121.4787,
        capacity: 20,
        current_bikes: 19
      };

      const bikeGPS = [
        { bike_id: 'BK001', latitude: 31.2354, longitude: 121.4786 }
      ];

      const result = riskRules.assessStationRisk(station, bikeGPS);
      
      expect(result.risks.some(r => r.type === 'CRITICAL_OVERFLOW')).toBe(true);
      expect(result.risk_score).toBeGreaterThan(0);
    });

    test('should assess critical shortage risk', () => {
      const station = {
        station_id: 'ST001',
        name: '测试站点',
        latitude: 31.2355,
        longitude: 121.4787,
        capacity: 20,
        current_bikes: 1
      };

      const result = riskRules.assessStationRisk(station, []);
      
      expect(result.risks.some(r => r.type === 'CRITICAL_SHORTAGE')).toBe(true);
    });
  });

  describe('calculateIQR', () => {
    test('should calculate correct IQR values', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = riskRules.calculateIQR(values);
      
      expect(result.q1).toBeDefined();
      expect(result.q3).toBeDefined();
      expect(result.iqr).toBe(result.q3 - result.q1);
      expect(result.median).toBe(5.5);
    });
  });

  describe('haversineDistance', () => {
    test('should calculate correct distance', () => {
      const dist = riskRules.haversineDistance(31.2355, 121.4787, 31.2360, 121.4790);
      
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(1000);
    });

    test('should return 0 for same coordinates', () => {
      const dist = riskRules.haversineDistance(31.2355, 121.4787, 31.2355, 121.4787);
      
      expect(dist).toBe(0);
    });
  });
});

describe('Metrics - classifyGap', () => {
  test('should classify critical overflow when utilization >= 95%', () => {
    const result = metrics.classifyGap(0.96, 24, 25);
    expect(result).toBe('CRITICAL_OVERFLOW');
  });

  test('should classify overflow when utilization >= 80%', () => {
    const result = metrics.classifyGap(0.85, 21, 25);
    expect(result).toBe('OVERFLOW');
  });

  test('should classify critical shortage when utilization < 10%', () => {
    const result = metrics.classifyGap(0.05, 1, 25);
    expect(result).toBe('CRITICAL_SHORTAGE');
  });

  test('should classify low when utilization between 10-30%', () => {
    const result = metrics.classifyGap(0.15, 4, 25);
    expect(result).toBe('LOW');
  });

  test('should classify normal when utilization between 30-60%', () => {
    const result = metrics.classifyGap(0.45, 11, 25);
    expect(result).toBe('NORMAL');
  });
});
