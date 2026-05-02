import {
  formatTimestamp,
  formatDuration,
  bpmToMs,
  clamp,
  calculateAverage,
  calculateStandardDeviation,
  generateId,
} from '../src/shared/utils';

describe('utils', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp to readable date string', () => {
      const timestamp = Date.now();
      const result = formatTimestamp(timestamp);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('formatDuration', () => {
    it('should return "进行中" when endTime is null', () => {
      const result = formatDuration(Date.now(), null);
      expect(result).toBe('进行中');
    });

    it('should format duration correctly in seconds', () => {
      const start = Date.now();
      const end = start + 5000;
      const result = formatDuration(start, end);
      
      expect(result).toBe('0分5秒');
    });

    it('should format duration correctly in minutes and seconds', () => {
      const start = Date.now();
      const end = start + 90000;
      const result = formatDuration(start, end);
      
      expect(result).toBe('1分30秒');
    });
  });

  describe('bpmToMs', () => {
    it('should convert BPM to milliseconds correctly', () => {
      expect(bpmToMs(60)).toBe(1000);
      expect(bpmToMs(120)).toBe(500);
      expect(bpmToMs(40)).toBe(1500);
    });
  });

  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should return min when value is below min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should return max when value is above max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('calculateAverage', () => {
    it('should return 0 for empty array', () => {
      expect(calculateAverage([])).toBe(0);
    });

    it('should calculate average correctly', () => {
      expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
      expect(calculateAverage([10, 20, 30])).toBe(20);
      expect(calculateAverage([5.5, 7.5])).toBe(6.5);
    });
  });

  describe('calculateStandardDeviation', () => {
    it('should return 0 for empty array', () => {
      expect(calculateStandardDeviation([])).toBe(0);
    });

    it('should return 0 for single element', () => {
      expect(calculateStandardDeviation([5])).toBe(0);
    });

    it('should calculate standard deviation correctly', () => {
      const result = calculateStandardDeviation([1, 2, 3, 4, 5]);
      expect(result).toBeCloseTo(1.414, 3);
    });

    it('should return 0 when all elements are the same', () => {
      expect(calculateStandardDeviation([5, 5, 5, 5])).toBe(0);
    });
  });
});
