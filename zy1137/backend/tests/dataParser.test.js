const {
  normalizeMacAddress,
  parseDateTime,
  parseInteger,
  parseBoolean,
  getDeviceTypeFromName,
  isRandomMacAddress
} = require('../utils/dataParser');

describe('dataParser', () => {
  describe('normalizeMacAddress', () => {
    it('should normalize MAC addresses with colons', () => {
      expect(normalizeMacAddress('00:1a:2b:3c:4d:5e')).toBe('00:1A:2B:3C:4D:5E');
    });

    it('should normalize MAC addresses with hyphens', () => {
      expect(normalizeMacAddress('00-1a-2b-3c-4d-5e')).toBe('00:1A:2B:3C:4D:5E');
    });

    it('should normalize MAC addresses without separators', () => {
      expect(normalizeMacAddress('001a2b3c4d5e')).toBe('00:1A:2B:3C:4D:5E');
    });

    it('should return null for invalid MAC addresses', () => {
      expect(normalizeMacAddress('invalid')).toBeNull();
      expect(normalizeMacAddress('00:1a:2b:3c:4d')).toBeNull();
      expect(normalizeMacAddress(null)).toBeNull();
      expect(normalizeMacAddress('')).toBeNull();
    });
  });

  describe('parseDateTime', () => {
    it('should parse ISO date strings', () => {
      const date = parseDateTime('2024-12-15T08:00:00Z');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-12-15T08:00:00.000Z');
    });

    it('should return Date objects as-is', () => {
      const original = new Date('2024-12-15T08:00:00Z');
      const result = parseDateTime(original);
      expect(result).toBe(original);
    });

    it('should return null for invalid dates', () => {
      expect(parseDateTime('invalid')).toBeNull();
      expect(parseDateTime(null)).toBeNull();
    });
  });

  describe('parseInteger', () => {
    it('should parse integer strings', () => {
      expect(parseInteger('42')).toBe(42);
      expect(parseInteger('-10')).toBe(-10);
    });

    it('should return defaultValue for invalid inputs', () => {
      expect(parseInteger('invalid')).toBeNull();
      expect(parseInteger('invalid', 0)).toBe(0);
      expect(parseInteger(null, -1)).toBe(-1);
    });
  });

  describe('parseBoolean', () => {
    it('should parse boolean strings', () => {
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('TRUE')).toBe(true);
      expect(parseBoolean('1')).toBe(true);
      expect(parseBoolean('yes')).toBe(true);
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('FALSE')).toBe(false);
      expect(parseBoolean('0')).toBe(false);
    });

    it('should return boolean values as-is', () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean(false)).toBe(false);
    });

    it('should return defaultValue for null/undefined', () => {
      expect(parseBoolean(null)).toBe(false);
      expect(parseBoolean(null, true)).toBe(true);
    });
  });

  describe('getDeviceTypeFromName', () => {
    it('should detect ESL devices', () => {
      expect(getDeviceTypeFromName('ESL-货架A1')).toBe('esl');
      expect(getDeviceTypeFromName('电子价签-牛奶区')).toBe('esl');
      expect(getDeviceTypeFromName('Label-001')).toBe('esl');
    });

    it('should detect printer devices', () => {
      expect(getDeviceTypeFromName('打印机-收银台1')).toBe('printer');
      expect(getDeviceTypeFromName('Printer-C2')).toBe('printer');
    });

    it('should detect beacon devices', () => {
      expect(getDeviceTypeFromName('Beacon-入口门')).toBe('beacon');
      expect(getDeviceTypeFromName('信标-仓库')).toBe('beacon');
    });

    it('should detect scanner devices', () => {
      expect(getDeviceTypeFromName('扫码枪-收银台1')).toBe('scanner');
      expect(getDeviceTypeFromName('Scanner-C2')).toBe('scanner');
    });

    it('should detect headset devices', () => {
      expect(getDeviceTypeFromName('耳机-员工张三')).toBe('headset');
      expect(getDeviceTypeFromName('Headset-ZS')).toBe('headset');
    });

    it('should return "other" for unknown devices', () => {
      expect(getDeviceTypeFromName('Unknown Device')).toBe('other');
      expect(getDeviceTypeFromName('')).toBe('other');
      expect(getDeviceTypeFromName(null)).toBe('other');
    });
  });

  describe('isRandomMacAddress', () => {
    it('should detect random MAC addresses', () => {
      expect(isRandomMacAddress('02:1A:2B:3C:4D:5E')).toBe(true);
      expect(isRandomMacAddress('06:1A:2B:3C:4D:5E')).toBe(true);
      expect(isRandomMacAddress('0A:1A:2B:3C:4D:5E')).toBe(true);
      expect(isRandomMacAddress('0E:1A:2B:3C:4D:5E')).toBe(true);
    });

    it('should not detect non-random MAC addresses', () => {
      expect(isRandomMacAddress('00:1A:2B:3C:4D:5E')).toBe(false);
      expect(isRandomMacAddress('01:1A:2B:3C:4D:5E')).toBe(false);
    });

    it('should return false for invalid MAC addresses', () => {
      expect(isRandomMacAddress('invalid')).toBe(false);
      expect(isRandomMacAddress(null)).toBe(false);
    });
  });
});
