const {
  isValidClickForAttribution,
} = require('../services/attributionService');

describe('Attribution Service', () => {
  describe('isValidClickForAttribution', () => {
    it('should return false for null click', () => {
      expect(isValidClickForAttribution(null)).toBe(false);
    });

    it('should return false for fraud click', () => {
      const click = {
        isFraud: true,
        isBlacklisted: false,
        isBot: false,
      };
      
      expect(isValidClickForAttribution(click)).toBe(false);
    });

    it('should return false for blacklisted click', () => {
      const click = {
        isFraud: false,
        isBlacklisted: true,
        isBot: false,
      };
      
      expect(isValidClickForAttribution(click)).toBe(false);
    });

    it('should return false for bot click', () => {
      const click = {
        isFraud: false,
        isBlacklisted: false,
        isBot: true,
      };
      
      expect(isValidClickForAttribution(click)).toBe(false);
    });

    it('should return true for valid click', () => {
      const click = {
        isFraud: false,
        isBlacklisted: false,
        isBot: false,
      };
      
      expect(isValidClickForAttribution(click)).toBe(true);
    });

    it('should return false if any flag is true', () => {
      const cases = [
        { isFraud: true, isBlacklisted: false, isBot: false },
        { isFraud: false, isBlacklisted: true, isBot: false },
        { isFraud: false, isBlacklisted: false, isBot: true },
        { isFraud: true, isBlacklisted: true, isBot: false },
        { isFraud: true, isBlacklisted: true, isBot: true },
      ];
      
      cases.forEach((c) => {
        expect(isValidClickForAttribution(c)).toBe(false);
      });
    });
  });
});
