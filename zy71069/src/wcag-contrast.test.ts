import {
  WCAG_THRESHOLDS,
  calculateContrast,
  getWcagLevels,
  generateContrastResult,
  formatRatio,
  getLevelLabel
} from './wcag-contrast';
import { ColorToken, TokenPair } from './types';

describe('wcag-contrast', () => {
  const whiteToken: ColorToken = {
    name: 'white',
    path: ['white'],
    value: '#ffffff',
    resolvedValue: '#ffffff',
    isAlias: false,
    rgba: { r: 255, g: 255, b: 255, a: 1 },
    hex: '#ffffff'
  };

  const blackToken: ColorToken = {
    name: 'black',
    path: ['black'],
    value: '#000000',
    resolvedValue: '#000000',
    isAlias: false,
    rgba: { r: 0, g: 0, b: 0, a: 1 },
    hex: '#000000'
  };

  const grayToken: ColorToken = {
    name: 'gray',
    path: ['gray'],
    value: '#888888',
    resolvedValue: '#888888',
    isAlias: false,
    rgba: { r: 136, g: 136, b: 136, a: 1 },
    hex: '#888888'
  };

  describe('WCAG_THRESHOLDS', () => {
    it('should have correct values', () => {
      expect(WCAG_THRESHOLDS.AA_NORMAL).toBe(4.5);
      expect(WCAG_THRESHOLDS.AA_LARGE).toBe(3);
      expect(WCAG_THRESHOLDS.AAA_NORMAL).toBe(7);
      expect(WCAG_THRESHOLDS.AAA_LARGE).toBe(4.5);
    });
  });

  describe('calculateContrast', () => {
    it('should calculate 21:1 for black on white', () => {
      const result = calculateContrast(blackToken.rgba, whiteToken.rgba);
      expect(result.ratio).toBe(21);
    });

    it('should calculate same ratio regardless of order', () => {
      const result1 = calculateContrast(blackToken.rgba, whiteToken.rgba);
      const result2 = calculateContrast(whiteToken.rgba, blackToken.rgba);
      expect(result1.ratio).toBe(result2.ratio);
    });
  });

  describe('getWcagLevels', () => {
    it('should return all true for 21:1 ratio', () => {
      const levels = getWcagLevels(21);
      expect(levels.aaNormal).toBe(true);
      expect(levels.aaLarge).toBe(true);
      expect(levels.aaaNormal).toBe(true);
      expect(levels.aaaLarge).toBe(true);
    });

    it('should return all false for 1:1 ratio', () => {
      const levels = getWcagLevels(1);
      expect(levels.aaNormal).toBe(false);
      expect(levels.aaLarge).toBe(false);
      expect(levels.aaaNormal).toBe(false);
      expect(levels.aaaLarge).toBe(false);
    });

    it('should pass AA large but not normal for 3:1', () => {
      const levels = getWcagLevels(3);
      expect(levels.aaNormal).toBe(false);
      expect(levels.aaLarge).toBe(true);
      expect(levels.aaaNormal).toBe(false);
      expect(levels.aaaLarge).toBe(false);
    });
  });

  describe('generateContrastResult', () => {
    const pair: TokenPair = {
      id: 'test',
      foreground: blackToken,
      background: whiteToken,
      context: 'test'
    };

    it('should generate correct result for black on white', () => {
      const result = generateContrastResult(pair, 4.5);
      expect(result.contrastRatio).toBe(21);
      expect(result.passes).toBe(true);
      expect(result.wcagLevel.aaaNormal).toBe(true);
    });

    it('should fail when ratio below threshold', () => {
      const lowContrastPair: TokenPair = {
        id: 'test',
        foreground: grayToken,
        background: whiteToken,
        context: 'test'
      };
      const result = generateContrastResult(lowContrastPair, 10);
      expect(result.passes).toBe(false);
    });
  });

  describe('formatRatio', () => {
    it('should format ratio correctly', () => {
      expect(formatRatio(4.5)).toBe('4.50:1');
      expect(formatRatio(7)).toBe('7.00:1');
      expect(formatRatio(21)).toBe('21.00:1');
    });
  });

  describe('getLevelLabel', () => {
    it('should return AAA for 7:1', () => {
      expect(getLevelLabel(true, 7, 4.5)).toBe('AAA');
    });

    it('should return AA for 4.5:1', () => {
      expect(getLevelLabel(true, 4.5, 4.5)).toBe('AA');
    });

    it('should return AA Large for 3:1', () => {
      expect(getLevelLabel(true, 3, 4.5)).toBe('AA Large');
    });

    it('should return FAIL when not passing', () => {
      expect(getLevelLabel(false, 2, 4.5)).toBe('FAIL');
    });
  });
});
