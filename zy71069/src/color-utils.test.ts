import {
  hexToRgba,
  rgbaToHex,
  parseColor,
  blendAlpha,
  getLuminance,
  getContrastRatio,
  isLightColor
} from './color-utils';
import { RGBA } from './types';

describe('color-utils', () => {
  describe('hexToRgba', () => {
    it('should parse 3-digit hex', () => {
      expect(hexToRgba('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    });

    it('should parse 6-digit hex', () => {
      expect(hexToRgba('#aabbcc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    });

    it('should parse 8-digit hex with alpha', () => {
      const result = hexToRgba('#aabbcc80');
      expect(result?.r).toBe(170);
      expect(result?.g).toBe(187);
      expect(result?.b).toBe(204);
      expect(result?.a).toBeCloseTo(0.5, 2);
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgba('#invalid')).toBeNull();
    });
  });

  describe('rgbaToHex', () => {
    it('should convert rgba to hex', () => {
      expect(rgbaToHex({ r: 170, g: 187, b: 204, a: 1 })).toBe('#aabbcc');
    });

    it('should include alpha channel when a < 1', () => {
      expect(rgbaToHex({ r: 170, g: 187, b: 204, a: 0.5 })).toBe('#aabbcc80');
    });
  });

  describe('parseColor', () => {
    it('should parse hex color', () => {
      expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });

    it('should parse rgb color', () => {
      expect(parseColor('rgb(255, 128, 0)')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    });

    it('should parse rgba color', () => {
      expect(parseColor('rgba(255, 128, 0, 0.5)')).toEqual({ r: 255, g: 128, b: 0, a: 0.5 });
    });

    it('should return null for invalid color', () => {
      expect(parseColor('invalid')).toBeNull();
    });
  });

  describe('blendAlpha', () => {
    it('should return foreground when alpha is 1', () => {
      const fg: RGBA = { r: 100, g: 100, b: 100, a: 1 };
      const bg: RGBA = { r: 200, g: 200, b: 200, a: 1 };
      expect(blendAlpha(fg, bg)).toEqual(fg);
    });

    it('should blend semi-transparent foreground with background', () => {
      const fg: RGBA = { r: 0, g: 0, b: 0, a: 0.5 };
      const bg: RGBA = { r: 255, g: 255, b: 255, a: 1 };
      const result = blendAlpha(fg, bg);
      expect(result.r).toBe(128);
      expect(result.g).toBe(128);
      expect(result.b).toBe(128);
      expect(result.a).toBe(1);
    });
  });

  describe('getLuminance', () => {
    it('should return 1 for white', () => {
      expect(getLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBe(1);
    });

    it('should return 0 for black', () => {
      expect(getLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
    });

    it('should calculate correct luminance for gray', () => {
      expect(getLuminance({ r: 128, g: 128, b: 128, a: 1 })).toBeCloseTo(0.2159, 3);
    });
  });

  describe('getContrastRatio', () => {
    it('should return 21 for black on white', () => {
      expect(getContrastRatio(0, 1)).toBe(21);
    });

    it('should return 1 for same color', () => {
      expect(getContrastRatio(0.5, 0.5)).toBe(1);
    });
  });

  describe('isLightColor', () => {
    it('should return true for white', () => {
      expect(isLightColor({ r: 255, g: 255, b: 255, a: 1 })).toBe(true);
    });

    it('should return false for black', () => {
      expect(isLightColor({ r: 0, g: 0, b: 0, a: 1 })).toBe(false);
    });
  });
});
