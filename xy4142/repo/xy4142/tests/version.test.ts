import {
  parseSemver,
  compareSemver,
  satisfiesVersion,
  checkVersionCompatibility,
  formatVersion,
  isStableVersion
} from '../src/utils/version';
import { VersionConstraint } from '../src/types';

describe('Version Utilities', () => {
  describe('parseSemver', () => {
    it('should parse valid semantic versions', () => {
      const result = parseSemver('1.2.3');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(2);
      expect(result.patch).toBe(3);
      expect(result.prerelease).toBeUndefined();
      expect(result.build).toBeUndefined();
    });

    it('should parse versions with prerelease', () => {
      const result = parseSemver('1.0.0-alpha');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
      expect(result.prerelease).toBe('alpha');
    });

    it('should parse versions with build metadata', () => {
      const result = parseSemver('1.0.0+build.123');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
      expect(result.build).toBe('build.123');
    });

    it('should parse versions with v prefix', () => {
      const result = parseSemver('v2.3.4');
      expect(result.major).toBe(2);
      expect(result.minor).toBe(3);
      expect(result.patch).toBe(4);
    });

    it('should throw error for invalid versions', () => {
      expect(() => parseSemver('invalid')).toThrow();
      expect(() => parseSemver('1')).toThrow();
      expect(() => parseSemver('1.2')).toThrow();
    });
  });

  describe('compareSemver', () => {
    it('should return 0 for equal versions', () => {
      expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
      expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
    });

    it('should return negative when a < b', () => {
      expect(compareSemver('1.2.3', '1.2.4')).toBeLessThan(0);
      expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0);
      expect(compareSemver('0.9.0', '1.0.0')).toBeLessThan(0);
    });

    it('should return positive when a > b', () => {
      expect(compareSemver('1.2.4', '1.2.3')).toBeGreaterThan(0);
      expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    });

    it('should consider prerelease versions lower than stable', () => {
      expect(compareSemver('1.0.0-alpha', '1.0.0')).toBeLessThan(0);
    });
  });

  describe('satisfiesVersion', () => {
    it('should satisfy minVersion constraint', () => {
      const constraint: VersionConstraint = { minVersion: '1.0.0' };
      expect(satisfiesVersion('1.0.0', constraint)).toBe(true);
      expect(satisfiesVersion('1.5.0', constraint)).toBe(true);
      expect(satisfiesVersion('2.0.0', constraint)).toBe(true);
      expect(satisfiesVersion('0.9.0', constraint)).toBe(false);
    });

    it('should satisfy maxVersion constraint', () => {
      const constraint: VersionConstraint = { maxVersion: '2.0.0' };
      expect(satisfiesVersion('2.0.0', constraint)).toBe(true);
      expect(satisfiesVersion('1.5.0', constraint)).toBe(true);
      expect(satisfiesVersion('2.1.0', constraint)).toBe(false);
    });

    it('should satisfy min and max range', () => {
      const constraint: VersionConstraint = { minVersion: '1.0.0', maxVersion: '2.0.0' };
      expect(satisfiesVersion('1.0.0', constraint)).toBe(true);
      expect(satisfiesVersion('1.5.0', constraint)).toBe(true);
      expect(satisfiesVersion('2.0.0', constraint)).toBe(true);
      expect(satisfiesVersion('0.9.0', constraint)).toBe(false);
      expect(satisfiesVersion('2.1.0', constraint)).toBe(false);
    });

    it('should satisfy specific compatibleVersions', () => {
      const constraint: VersionConstraint = { compatibleVersions: ['1.0.0', '1.2.0', '2.0.0'] };
      expect(satisfiesVersion('1.0.0', constraint)).toBe(true);
      expect(satisfiesVersion('1.2.0', constraint)).toBe(true);
      expect(satisfiesVersion('1.1.0', constraint)).toBe(false);
    });
  });

  describe('checkVersionCompatibility', () => {
    it('should be compatible when plugin version matches system major', () => {
      const result = checkVersionCompatibility('1.2.0', '1.0.0');
      expect(result.compatible).toBe(true);
      expect(result.pluginVersion).toBe('1.2.0');
      expect(result.systemVersion).toBe('1.0.0');
    });

    it('should not be compatible when major versions differ', () => {
      const result = checkVersionCompatibility('2.0.0', '1.0.0');
      expect(result.compatible).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.recommendedAction).toBeDefined();
    });

    it('should not be compatible when plugin is behind minor', () => {
      const result = checkVersionCompatibility('1.1.0', '1.5.0');
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('minor');
    });
  });

  describe('formatVersion', () => {
    it('should add v prefix if not present', () => {
      expect(formatVersion('1.0.0')).toBe('v1.0.0');
    });

    it('should preserve existing v prefix', () => {
      expect(formatVersion('v1.0.0')).toBe('v1.0.0');
    });
  });

  describe('isStableVersion', () => {
    it('should return true for stable versions', () => {
      expect(isStableVersion('1.0.0')).toBe(true);
      expect(isStableVersion('2.3.4')).toBe(true);
    });

    it('should return false for prerelease versions', () => {
      expect(isStableVersion('1.0.0-alpha')).toBe(false);
      expect(isStableVersion('1.0.0-beta.1')).toBe(false);
      expect(isStableVersion('1.0.0-rc.1')).toBe(false);
    });
  });
});
