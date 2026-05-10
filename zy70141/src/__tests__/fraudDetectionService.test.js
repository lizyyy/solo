const {
  createFraudResult,
  checkBotDetection,
  aggregateFraudResults,
} = require('../services/fraudDetectionService');

describe('Fraud Detection Service', () => {
  describe('createFraudResult', () => {
    it('should create fraud result with isFraud=true', () => {
      const result = createFraudResult(true, 'bot_detected', 0.9, { userAgent: 'bot' });
      
      expect(result.isFraud).toBe(true);
      expect(result.reason).toBe('bot_detected');
      expect(result.score).toBe(0.9);
      expect(result.details.userAgent).toBe('bot');
    });

    it('should create fraud result with isFraud=false', () => {
      const result = createFraudResult(false, null, 0.1);
      
      expect(result.isFraud).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.score).toBe(0.1);
    });

    it('should clamp score between 0 and 1', () => {
      const result1 = createFraudResult(true, 'test', 1.5);
      const result2 = createFraudResult(true, 'test', -0.5);
      
      expect(result1.score).toBe(1);
      expect(result2.score).toBe(0);
    });
  });

  describe('checkBotDetection', () => {
    it('should detect bot device fingerprint', () => {
      const deviceFingerprint = {
        isBot: true,
        userAgent: 'Googlebot/2.1',
      };
      
      const result = checkBotDetection(deviceFingerprint);
      
      expect(result.isFraud).toBe(true);
      expect(result.reason).toBe('bot_detected');
      expect(result.score).toBeGreaterThan(0.9);
    });

    it('should return false for non-bot device', () => {
      const deviceFingerprint = {
        isBot: false,
        userAgent: 'Chrome/120.0',
      };
      
      const result = checkBotDetection(deviceFingerprint);
      
      expect(result.isFraud).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle null device fingerprint', () => {
      const result = checkBotDetection(null);
      
      expect(result.isFraud).toBe(false);
    });
  });

  describe('aggregateFraudResults', () => {
    it('should mark as fraud if any result is fraud', () => {
      const results = [
        { isFraud: false, score: 0, reason: null, details: {} },
        { isFraud: true, score: 0.9, reason: 'bot_detected', details: { isBot: true } },
        { isFraud: false, score: 0.1, reason: null, details: {} },
      ];
      
      const aggregated = aggregateFraudResults(results);
      
      expect(aggregated.isFraud).toBe(true);
      expect(aggregated.reasons).toContain('bot_detected');
      expect(aggregated.primaryReason).toBe('bot_detected');
    });

    it('should calculate average score', () => {
      const results = [
        { isFraud: false, score: 0.1, reason: null, details: { a: 1 } },
        { isFraud: false, score: 0.3, reason: null, details: { b: 2 } },
        { isFraud: false, score: 0.2, reason: null, details: { c: 3 } },
      ];
      
      const aggregated = aggregateFraudResults(results);
      
      expect(aggregated.score).toBeCloseTo(0.2);
      expect(aggregated.details.a).toBe(1);
      expect(aggregated.details.b).toBe(2);
      expect(aggregated.details.c).toBe(3);
    });

    it('should handle empty results', () => {
      const aggregated = aggregateFraudResults([]);
      
      expect(aggregated.isFraud).toBe(false);
      expect(aggregated.score).toBe(0);
      expect(aggregated.reasons).toEqual([]);
    });

    it('should collect all fraud reasons', () => {
      const results = [
        { isFraud: true, score: 0.9, reason: 'bot_detected', details: {} },
        { isFraud: true, score: 0.8, reason: 'high_frequency', details: {} },
        { isFraud: false, score: 0.1, reason: null, details: {} },
      ];
      
      const aggregated = aggregateFraudResults(results);
      
      expect(aggregated.reasons).toEqual(['bot_detected', 'high_frequency']);
      expect(aggregated.primaryReason).toBe('bot_detected');
    });
  });
});
