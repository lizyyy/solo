import { describe, it, expect } from 'vitest';
import {
  lerp,
  clamp,
  degToRad,
  radToDeg,
  distance3D,
  vector3Lerp,
  generateUUID,
  formatTime,
} from '@/utils/math';

describe('math utilities', () => {
  describe('lerp', () => {
    it('should interpolate linearly between two values', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(10, 20, 0)).toBe(10);
      expect(lerp(10, 20, 1)).toBe(20);
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('degToRad / radToDeg', () => {
    it('should convert degrees to radians', () => {
      expect(degToRad(0)).toBe(0);
      expect(degToRad(180)).toBe(Math.PI);
      expect(degToRad(90)).toBe(Math.PI / 2);
    });

    it('should convert radians to degrees', () => {
      expect(radToDeg(0)).toBe(0);
      expect(radToDeg(Math.PI)).toBe(180);
      expect(radToDeg(Math.PI / 2)).toBe(90);
    });
  });

  describe('distance3D', () => {
    it('should calculate correct 3D distance', () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 3, y: 4, z: 0 };
      expect(distance3D(a, b)).toBe(5);
    });

    it('should handle same point', () => {
      const a = { x: 1, y: 2, z: 3 };
      expect(distance3D(a, a)).toBe(0);
    });
  });

  describe('vector3Lerp', () => {
    it('should interpolate vectors', () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 10, y: 20, z: 30 };
      const result = vector3Lerp(a, b, 0.5);
      expect(result).toEqual({ x: 5, y: 10, z: 15 });
    });
  });

  describe('generateUUID', () => {
    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
      expect(uuid1.length).toBeGreaterThan(0);
    });
  });

  describe('formatTime', () => {
    it('should format seconds correctly', () => {
      expect(formatTime(0)).toBe('00:00.00');
      expect(formatTime(61.5)).toBe('01:01.50');
      expect(formatTime(125.25)).toBe('02:05.25');
    });
  });
});
