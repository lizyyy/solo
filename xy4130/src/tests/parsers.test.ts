import { describe, it, expect } from 'vitest';
import { parseJSON, parseCSV, detectAndParse } from '@/parsers';

describe('parsers', () => {
  describe('parseJSON', () => {
    it('should parse valid JSON', () => {
      const json = '{"name": "test", "value": 42}';
      const result = parseJSON(json);
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should throw on invalid JSON', () => {
      const invalidJson = 'not valid json {';
      expect(() => parseJSON(invalidJson)).toThrow();
    });
  });

  describe('parseCSV', () => {
    it('should parse valid CSV with headers', () => {
      const csv = 'name,age\nAlice,30\nBob,25';
      const result = parseCSV<{ name: string; age: number }>(csv);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Alice');
      expect(result[0].age).toBe(30);
    });
  });

  describe('detectAndParse', () => {
    it('should detect and parse JSON files', () => {
      const json = '{"name": "test"}';
      const result = detectAndParse('test.json', json);
      expect(result).toEqual({ name: 'test' });
    });

    it('should return empty object for unsupported files', () => {
      const result = detectAndParse('test.txt', 'some content');
      expect(Object.keys(result).length).toBe(0);
    });
  });
});
