import { 
  parseTimestamp,
  extractDeviceIdFromFilename,
  extractTimeFromFilename,
  calculateTimeDrift,
  formatDuration,
  groupBy,
  sortBy,
  generateId
} from '../src/utils';

describe('Utils', () => {
  describe('generateId', () => {
    it('should generate unique UUIDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe('parseTimestamp', () => {
    it('should parse ISO 8601 format', () => {
      const result = parseTimestamp('2026-04-28T08:00:00Z');
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2026);
      expect(result?.getMonth()).toBe(3);
      expect(result?.getDate()).toBe(28);
    });

    it('should parse YYYYMMDD_HHMMSS format', () => {
      const result = parseTimestamp('20260428_080000');
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2026);
    });

    it('should parse YYYY-MM-DD format', () => {
      const result = parseTimestamp('2026-04-28');
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2026);
    });

    it('should return null for invalid timestamps', () => {
      expect(parseTimestamp('invalid')).toBeNull();
      expect(parseTimestamp('')).toBeNull();
    });
  });

  describe('extractDeviceIdFromFilename', () => {
    it('should extract device ID from known IDs', () => {
      const knownIds = ['LOGGER001', 'SENSOR003'];
      
      expect(extractDeviceIdFromFilename('LOGGER001_20260428.csv', knownIds)).toBe('LOGGER001');
      expect(extractDeviceIdFromFilename('sensor003_data.log', knownIds)).toBe('SENSOR003');
    });

    it('should extract device ID using patterns', () => {
      expect(extractDeviceIdFromFilename('DEVICE_12345_data.csv')).toBe('12345');
      expect(extractDeviceIdFromFilename('SENSOR_001_2026.csv')).toBe('001');
    });

    it('should return undefined for no match', () => {
      expect(extractDeviceIdFromFilename('unnamed_file.csv')).toBeUndefined();
    });
  });

  describe('extractTimeFromFilename', () => {
    it('should extract timestamp from filename', () => {
      const result = extractTimeFromFilename('LOGGER001_20260428_080000.csv');
      expect(result).toBeDefined();
    });

    it('should extract YYYY-MM-DD format', () => {
      const result = extractTimeFromFilename('data_2026-04-28.csv');
      expect(result).toBeDefined();
    });
  });

  describe('calculateTimeDrift', () => {
    it('should calculate positive drift (device time is fast)', () => {
      const deviceTime = new Date('2026-04-28T08:15:00Z');
      const actualTime = new Date('2026-04-28T08:00:00Z');
      
      const drift = calculateTimeDrift(deviceTime, actualTime);
      expect(drift).toBe(15);
    });

    it('should calculate negative drift (device time is slow)', () => {
      const deviceTime = new Date('2026-04-28T07:45:00Z');
      const actualTime = new Date('2026-04-28T08:00:00Z');
      
      const drift = calculateTimeDrift(deviceTime, actualTime);
      expect(drift).toBe(-15);
    });
  });

  describe('formatDuration', () => {
    it('should format minutes only', () => {
      expect(formatDuration(45)).toBe('45m');
      expect(formatDuration(-30)).toBe('30m');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(150)).toBe('2h 30m');
    });
  });

  describe('groupBy', () => {
    interface TestItem {
      id: string;
      category: string;
      value: number;
    }

    it('should group by key field', () => {
      const items: TestItem[] = [
        { id: '1', category: 'A', value: 10 },
        { id: '2', category: 'B', value: 20 },
        { id: '3', category: 'A', value: 30 }
      ];

      const grouped = groupBy(items, 'category');
      
      expect(grouped['A']).toHaveLength(2);
      expect(grouped['B']).toHaveLength(1);
    });

    it('should group by function', () => {
      const items: TestItem[] = [
        { id: '1', category: 'A', value: 10 },
        { id: '2', category: 'B', value: 20 },
        { id: '3', category: 'A', value: 30 }
      ];

      const grouped = groupBy(items, item => item.value > 15 ? 'high' : 'low');
      
      expect(grouped['low']).toHaveLength(1);
      expect(grouped['high']).toHaveLength(2);
    });
  });

  describe('sortBy', () => {
    interface TestItem {
      name: string;
      value: number;
    }

    it('should sort by key field', () => {
      const items: TestItem[] = [
        { name: 'Z', value: 3 },
        { name: 'A', value: 1 },
        { name: 'M', value: 2 }
      ];

      const sorted = sortBy(items, 'name');
      
      expect(sorted[0].name).toBe('A');
      expect(sorted[1].name).toBe('M');
      expect(sorted[2].name).toBe('Z');
    });

    it('should sort by function', () => {
      const items: TestItem[] = [
        { name: 'Z', value: 30 },
        { name: 'A', value: 10 },
        { name: 'M', value: 20 }
      ];

      const sorted = sortBy(items, item => item.value);
      
      expect(sorted[0].value).toBe(10);
      expect(sorted[1].value).toBe(20);
      expect(sorted[2].value).toBe(30);
    });
  });
});
