const RiskAnalyzer = require('../services/riskAnalyzer');

describe('RiskAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new RiskAnalyzer();
  });

  describe('groupSimilarAddresses', () => {
    it('should group MAC addresses with same OUI', () => {
      const scanRecords = [
        { mac_address: '00:1A:2B:3C:4D:5E', scan_timestamp: new Date() },
        { mac_address: '00:1A:2B:3C:4D:5F', scan_timestamp: new Date() },
        { mac_address: '11:22:33:44:55:66', scan_timestamp: new Date() }
      ];

      const groups = analyzer.groupSimilarAddresses(scanRecords);
      
      expect(groups.length).toBe(1);
      expect(groups[0].addresses.length).toBe(2);
      expect(groups[0].addresses).toContain('00:1A:2B:3C:4D:5E');
      expect(groups[0].addresses).toContain('00:1A:2B:3C:4D:5F');
    });

    it('should not group addresses with different OUI', () => {
      const scanRecords = [
        { mac_address: '00:1A:2B:3C:4D:5E', scan_timestamp: new Date() },
        { mac_address: '11:22:33:44:55:66', scan_timestamp: new Date() }
      ];

      const groups = analyzer.groupSimilarAddresses(scanRecords);
      expect(groups.length).toBe(0);
    });
  });

  describe('areAddressesSimilar', () => {
    it('should return true for same OUI', () => {
      expect(analyzer.areAddressesSimilar('00:1A:2B:3C:4D:5E', '00:1A:2B:AA:BB:CC')).toBe(true);
    });

    it('should return false for different OUI', () => {
      expect(analyzer.areAddressesSimilar('00:1A:2B:3C:4D:5E', '11:22:33:44:55:66')).toBe(false);
    });

    it('should handle different formats', () => {
      expect(analyzer.areAddressesSimilar('001a2b3c4d5e', '00:1A:2B:3C:4D:5E')).toBe(true);
    });

    it('should return false for invalid MAC addresses', () => {
      expect(analyzer.areAddressesSimilar('invalid', '00:1A:2B:3C:4D:5E')).toBe(false);
      expect(analyzer.areAddressesSimilar(null, '00:1A:2B:3C:4D:5E')).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      expect(analyzer.config.rssi.fluctuationThreshold).toBe(20);
      expect(analyzer.config.rssi.weakThreshold).toBe(-75);
      expect(analyzer.config.disconnect.criticalMinutes).toBe(120);
      expect(analyzer.config.battery.criticalLevel).toBe(10);
      expect(analyzer.config.pairing.failThreshold).toBe(3);
    });

    it('should allow custom configuration', () => {
      const customConfig = {
        rssi: {
          fluctuationThreshold: 30,
          weakThreshold: -80
        }
      };
      const customAnalyzer = new RiskAnalyzer(customConfig);
      
      expect(customAnalyzer.config.rssi.fluctuationThreshold).toBe(30);
      expect(customAnalyzer.config.rssi.weakThreshold).toBe(-80);
      expect(customAnalyzer.config.disconnect.criticalMinutes).toBe(120);
    });
  });
});
