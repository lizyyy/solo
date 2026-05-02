import { describe, it, expect } from 'vitest';
import { parseBaysJson } from '@/parsers/baysParser';
import { parseCargoCsv } from '@/parsers/cargoParser';
import { parseRulesYaml } from '@/parsers/rulesParser';

describe('Parsers', () => {
  describe('baysParser', () => {
    it('should parse valid bays JSON', async () => {
      const content = JSON.stringify([{
        id: 'bay-1',
        name: 'A1',
        position: { x: -8, y: 0, z: -5 },
        dimensions: { width: 6, height: 4, depth: 8 },
        maxWeight: 200,
        isDeck: false,
      }]);
      
      const result = await parseBaysJson(content);
      expect(result.errors).toHaveLength(0);
      expect(result.bays).toHaveLength(1);
      expect(result.bays[0].id).toBe('bay-1');
      expect(result.bays[0].name).toBe('A1');
    });

    it('should handle invalid JSON', async () => {
      const result = await parseBaysJson('invalid json');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('json');
    });

    it('should validate required fields', async () => {
      const content = JSON.stringify([{
        id: 123,
        name: 'A1',
        position: { x: -8, y: 0 },
        dimensions: { width: 6, height: 4 },
        maxWeight: -10,
      }]);
      
      const result = await parseBaysJson(content);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('cargoParser', () => {
    it('should parse valid CSV', async () => {
      const content = 'containerNo,weight,category\nCSLU1234567,25,general';
      const result = await parseCargoCsv(content);
      expect(result.errors).toHaveLength(0);
      expect(result.cargoItems).toHaveLength(1);
      expect(result.cargoItems[0].containerNo).toBe('CSLU1234567');
      expect(result.cargoItems[0].weight).toBe(25);
    });

    it('should detect duplicate container numbers', async () => {
      const content = 'containerNo,weight,category\nCSLU1234567,25,general\nCSLU1234567,30,general';
      const result = await parseCargoCsv(content);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('containerNo');
      expect(result.errors[0].message).toContain('Duplicate');
    });

    it('should handle missing weight', async () => {
      const content = 'containerNo,weight,category\nCSLU1234567,,general';
      const result = await parseCargoCsv(content);
      expect(result.errors).toHaveLength(0);
      expect(result.cargoItems[0].weight).toBeNull();
    });

    it('should detect dangerous goods', async () => {
      const content = 'containerNo,weight,category,dangerousClass\nDGXU9999991,15,dangerous,Class3';
      const result = await parseCargoCsv(content);
      expect(result.cargoItems[0].isDangerous).toBe(true);
      expect(result.cargoItems[0].dangerousClass).toBe('Class3');
    });
  });

  describe('rulesParser', () => {
    it('should parse valid YAML', async () => {
      const content = `maxTotalWeight: 1000
maxDeckWeight: 300
maxCargoHoldWeight: 700
balanceLimits:
  maxPortStarboardDifference: 100
  maxForeAftDifference: 80
dangerousGoods:
  isolationDistance: 5`;
      
      const result = await parseRulesYaml(content);
      expect(result.rules.maxTotalWeight).toBe(1000);
      expect(result.rules.balanceLimits.maxPortStarboardDifference).toBe(100);
    });

    it('should validate required values', async () => {
      const content = 'maxTotalWeight: 0';
      const result = await parseRulesYaml(content);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});