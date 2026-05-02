import { 
  formatTimestamp, 
  formatDuration, 
  parseTimestamp,
  mean,
  median,
  stdDev,
  calculatePercentage,
  clamp,
  groupBy,
  sortByKey,
  chunk,
  deepClone,
  isObject,
  safeJsonParse,
  generateId
} from '../src/utils';

describe('Utils', () => {
  describe('formatTimestamp', () => {
    it('should format timestamp to ISO string', () => {
      const timestamp = 1714644000000;
      const result = formatTimestamp(timestamp);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500.00ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5.00s');
    });

    it('should format minutes', () => {
      expect(formatDuration(90000)).toBe('1m 30.00s');
    });

    it('should format hours', () => {
      expect(formatDuration(3723000)).toBe('1h 2m 3.00s');
    });
  });

  describe('parseTimestamp', () => {
    it('should parse number timestamp', () => {
      const timestamp = 1714644000000;
      expect(parseTimestamp(timestamp)).toBe(timestamp);
    });

    it('should parse ISO string', () => {
      const isoString = '2024-05-02T14:00:00.000Z';
      const result = parseTimestamp(isoString);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should parse relative time', () => {
      const result = parseTimestamp('10 seconds ago');
      const now = Date.now();
      expect(result).toBeLessThanOrEqual(now);
      expect(result).toBeGreaterThan(now - 11000);
    });

    it('should parse time only format', () => {
      const result = parseTimestamp('14:30:00');
      const date = new Date(result);
      expect(date.getHours()).toBe(14);
      expect(date.getMinutes()).toBe(30);
      expect(date.getSeconds()).toBe(0);
    });

    it('should throw for invalid format', () => {
      expect(() => parseTimestamp('invalid')).toThrow();
    });
  });

  describe('mean', () => {
    it('should calculate mean of numbers', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should return 0 for empty array', () => {
      expect(mean([])).toBe(0);
    });
  });

  describe('median', () => {
    it('should calculate median for odd length', () => {
      expect(median([1, 3, 5])).toBe(3);
    });

    it('should calculate median for even length', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it('should return 0 for empty array', () => {
      expect(median([])).toBe(0);
    });
  });

  describe('stdDev', () => {
    it('should calculate standard deviation', () => {
      const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(2, 5);
    });

    it('should return 0 for single value', () => {
      expect(stdDev([5])).toBe(0);
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage', () => {
      expect(calculatePercentage(25, 100)).toBe(25);
    });

    it('should handle zero total', () => {
      expect(calculatePercentage(25, 0)).toBe(0);
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(10, 0, 100)).toBe(10);
      expect(clamp(-5, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });
  });

  describe('groupBy', () => {
    it('should group array by key function', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 }
      ];
      const result = groupBy(items, item => item.type);
      expect(result['a'].length).toBe(2);
      expect(result['b'].length).toBe(1);
    });
  });

  describe('sortByKey', () => {
    it('should sort array by key function', () => {
      const items = [
        { id: 3, name: 'c' },
        { id: 1, name: 'a' },
        { id: 2, name: 'b' }
      ];
      const result = sortByKey(items, item => item.id);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const result = chunk([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });
  });

  describe('deepClone', () => {
    it('should deep clone object', () => {
      const original = { a: 1, b: { c: 2 } };
      const clone = deepClone(original);
      expect(clone).toEqual(original);
      clone.b.c = 99;
      expect(original.b.c).toBe(2);
    });
  });

  describe('isObject', () => {
    it('should check if value is object', () => {
      expect(isObject({})).toBe(true);
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('string')).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"a": 1}');
      expect(result).toEqual({ a: 1 });
    });

    it('should return fallback for invalid JSON', () => {
      const result = safeJsonParse('invalid json', { fallback: true });
      expect(result).toEqual({ fallback: true });
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });
});
