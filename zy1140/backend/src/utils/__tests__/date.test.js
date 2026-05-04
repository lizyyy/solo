const { parseAppleHealthDate, getDateRange, formatDuration } = require('../utils/date');

describe('Date Utils', () => {
  describe('parseAppleHealthDate', () => {
    test('should parse Apple Health date format with timezone', () => {
      const dateStr = '2026-04-01 08:00:00 +0800';
      const result = parseAppleHealthDate(dateStr);
      expect(result).toBeInstanceOf(Date);
    });

    test('should parse ISO date format', () => {
      const dateStr = '2026-04-01T08:00:00+08:00';
      const result = parseAppleHealthDate(dateStr);
      expect(result).toBeInstanceOf(Date);
    });

    test('should return null for invalid date', () => {
      const result = parseAppleHealthDate('invalid-date');
      expect(result).toBeNull();
    });

    test('should return null for empty string', () => {
      const result = parseAppleHealthDate('');
      expect(result).toBeNull();
    });
  });

  describe('getDateRange', () => {
    test('should generate date range between two dates', () => {
      const start = '2026-04-01';
      const end = '2026-04-05';
      const result = getDateRange(start, end);
      expect(result).toHaveLength(5);
      expect(result[0]).toBe('2026-04-01');
      expect(result[4]).toBe('2026-04-05');
    });

    test('should handle single day range', () => {
      const start = '2026-04-01';
      const end = '2026-04-01';
      const result = getDateRange(start, end);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('2026-04-01');
    });
  });

  describe('formatDuration', () => {
    test('should format minutes correctly', () => {
      expect(formatDuration(30)).toBe('30分钟');
      expect(formatDuration(60)).toBe('1小时0分钟');
      expect(formatDuration(90)).toBe('1小时30分钟');
      expect(formatDuration(150)).toBe('2小时30分钟');
    });

    test('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0分钟');
    });
  });
});
