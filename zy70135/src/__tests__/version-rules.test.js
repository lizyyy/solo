const VersionRules = require('../core/version-rules');
const { SHARE_VERSION_STATUS, BLACKLIST_STATUS } = require('../core/constants');

describe('VersionRules', () => {
  describe('generateVersionNumber', () => {
    it('should generate first version as 1.0.0', () => {
      const version = VersionRules.generateVersionNumber([]);
      expect(version).toBe('1.0.0');
    });

    it('should generate 1.0.0 when no published versions exist', () => {
      const existingVersions = [
        { versionNumber: '1.0.0', status: 'draft', createdAt: new Date() },
      ];
      const version = VersionRules.generateVersionNumber(existingVersions);
      expect(version).toBe('1.0.0');
    });

    it('should increment patch version for new drafts', () => {
      const existingVersions = [
        { versionNumber: '1.0.0', status: 'published', createdAt: new Date() },
      ];
      const version = VersionRules.generateVersionNumber(existingVersions);
      expect(version).toBe('1.0.1');
    });

    it('should find latest published version', () => {
      const now = new Date();
      const older = new Date(now.getTime() - 86400000);
      const existingVersions = [
        { versionNumber: '1.0.0', status: 'published', createdAt: older },
        { versionNumber: '2.0.0', status: 'published', createdAt: now },
        { versionNumber: '3.0.0', status: 'draft', createdAt: new Date(now.getTime() + 86400000) },
      ];
      const version = VersionRules.generateVersionNumber(existingVersions);
      expect(version).toBe('2.0.1');
    });
  });

  describe('canPublish', () => {
    it('should allow publishing draft with changes', () => {
      expect(VersionRules.canPublish(SHARE_VERSION_STATUS.DRAFT, true)).toBe(true);
    });

    it('should NOT allow publishing already published version', () => {
      expect(() => VersionRules.canPublish(SHARE_VERSION_STATUS.PUBLISHED, true)).toThrow();
    });

    it('should NOT allow publishing archived version', () => {
      expect(() => VersionRules.canPublish(SHARE_VERSION_STATUS.ARCHIVED, true)).toThrow();
    });

    it('should NOT allow publishing draft without changes', () => {
      expect(() => VersionRules.canPublish(SHARE_VERSION_STATUS.DRAFT, false)).toThrow();
    });
  });

  describe('canArchive', () => {
    it('should allow archiving published version', () => {
      expect(VersionRules.canArchive(SHARE_VERSION_STATUS.PUBLISHED)).toBe(true);
    });

    it('should NOT allow archiving draft version', () => {
      expect(() => VersionRules.canArchive(SHARE_VERSION_STATUS.DRAFT)).toThrow();
    });

    it('should NOT allow archiving already archived version', () => {
      expect(() => VersionRules.canArchive(SHARE_VERSION_STATUS.ARCHIVED)).toThrow();
    });
  });

  describe('canDelete', () => {
    it('should allow deleting draft version', () => {
      expect(VersionRules.canDelete(SHARE_VERSION_STATUS.DRAFT)).toBe(true);
    });

    it('should NOT allow deleting published version', () => {
      expect(() => VersionRules.canDelete(SHARE_VERSION_STATUS.PUBLISHED)).toThrow();
    });

    it('should allow deleting archived version (no restriction)', () => {
      expect(VersionRules.canDelete(SHARE_VERSION_STATUS.ARCHIVED)).toBe(true);
    });
  });

  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      expect(VersionRules.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should return 1 when version1 is greater', () => {
      expect(VersionRules.compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(VersionRules.compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(VersionRules.compareVersions('1.0.1', '1.0.0')).toBe(1);
    });

    it('should return -1 when version1 is less', () => {
      expect(VersionRules.compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(VersionRules.compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(VersionRules.compareVersions('1.0.0', '1.0.1')).toBe(-1);
    });

    it('should handle versions with different lengths', () => {
      expect(VersionRules.compareVersions('1.0', '1.0.0')).toBe(0);
      expect(VersionRules.compareVersions('1', '1.0.0')).toBe(0);
    });
  });

  describe('calculateDiff', () => {
    it('should identify added items', () => {
      const oldSnapshot = [];
      const newSnapshot = [
        { memberIdentifier: '13800138001', status: 'active', source: 'manual', reason: 'test' },
      ];
      const result = VersionRules.calculateDiff(oldSnapshot, newSnapshot);
      expect(result.added.length).toBe(1);
      expect(result.summary.added).toBe(1);
    });

    it('should identify removed items', () => {
      const oldSnapshot = [
        { memberIdentifier: '13800138001', status: 'active', source: 'manual', reason: 'test' },
      ];
      const newSnapshot = [];
      const result = VersionRules.calculateDiff(oldSnapshot, newSnapshot);
      expect(result.removed.length).toBe(1);
      expect(result.summary.removed).toBe(1);
    });

    it('should identify updated items (status changed)', () => {
      const oldSnapshot = [
        { memberIdentifier: '13800138001', status: BLACKLIST_STATUS.ACTIVE, source: 'manual', reason: 'old' },
      ];
      const newSnapshot = [
        { memberIdentifier: '13800138001', status: BLACKLIST_STATUS.INACTIVE, source: 'manual', reason: 'new' },
      ];
      const result = VersionRules.calculateDiff(oldSnapshot, newSnapshot);
      expect(result.updated.length).toBe(1);
      expect(result.summary.updated).toBe(1);
    });

    it('should identify unchanged items', () => {
      const oldSnapshot = [
        { memberIdentifier: '13800138001', status: BLACKLIST_STATUS.ACTIVE, source: 'manual', reason: 'test' },
      ];
      const newSnapshot = [
        { memberIdentifier: '13800138001', status: BLACKLIST_STATUS.ACTIVE, source: 'manual', reason: 'different reason' },
      ];
      const result = VersionRules.calculateDiff(oldSnapshot, newSnapshot);
      expect(result.unchanged.length).toBe(1);
      expect(result.summary.unchanged).toBe(1);
    });

    it('should handle mixed changes correctly', () => {
      const oldSnapshot = [
        { memberIdentifier: '1', status: BLACKLIST_STATUS.ACTIVE, source: 'manual', reason: 'old' },
        { memberIdentifier: '2', status: BLACKLIST_STATUS.ACTIVE, source: 'manual', reason: 'same' },
        { memberIdentifier: '3', status: BLACKLIST_STATUS.ACTIVE, source: 'manual', reason: 'to_remove' },
      ];
      const newSnapshot = [
        { memberIdentifier: '1', status: BLACKLIST_STATUS.INACTIVE, source: 'manual', reason: 'new' },
        { memberIdentifier: '2', status: BLACKLIST_STATUS.ACTIVE, source: 'manual', reason: 'same' },
        { memberIdentifier: '4', status: BLACKLIST_STATUS.ACTIVE, source: 'manual', reason: 'new_item' },
      ];
      const result = VersionRules.calculateDiff(oldSnapshot, newSnapshot);
      expect(result.summary.added).toBe(1);
      expect(result.summary.removed).toBe(1);
      expect(result.summary.updated).toBe(1);
      expect(result.summary.unchanged).toBe(1);
      expect(result.summary.total).toBe(3);
    });
  });

  describe('hasSignificantChanges', () => {
    it('should return true when there are added items', () => {
      const diff = { added: [{}], removed: [], updated: [] };
      expect(VersionRules.hasSignificantChanges(diff)).toBe(true);
    });

    it('should return true when there are removed items', () => {
      const diff = { added: [], removed: [{}], updated: [] };
      expect(VersionRules.hasSignificantChanges(diff)).toBe(true);
    });

    it('should return true when there are updated items', () => {
      const diff = { added: [], removed: [], updated: [{}] };
      expect(VersionRules.hasSignificantChanges(diff)).toBe(true);
    });

    it('should return false when there are no changes', () => {
      const diff = { added: [], removed: [], updated: [] };
      expect(VersionRules.hasSignificantChanges(diff)).toBe(false);
    });
  });

  describe('validateSnapshot', () => {
    it('should accept valid snapshot', () => {
      const items = [
        { memberIdentifier: '13800138001', status: BLACKLIST_STATUS.ACTIVE, source: 'manual' },
        { memberIdentifier: '13800138002', status: BLACKLIST_STATUS.ACTIVE, source: 'api_import' },
      ];
      expect(VersionRules.validateSnapshot(items)).toBe(true);
    });

    it('should reject snapshot with missing memberIdentifier', () => {
      const items = [
        { status: BLACKLIST_STATUS.ACTIVE, source: 'manual' },
      ];
      expect(() => VersionRules.validateSnapshot(items)).toThrow();
    });

    it('should reject snapshot with missing status', () => {
      const items = [
        { memberIdentifier: '13800138001', source: 'manual' },
      ];
      expect(() => VersionRules.validateSnapshot(items)).toThrow();
    });

    it('should reject snapshot with missing source', () => {
      const items = [
        { memberIdentifier: '13800138001', status: BLACKLIST_STATUS.ACTIVE },
      ];
      expect(() => VersionRules.validateSnapshot(items)).toThrow();
    });

    it('should reject snapshot with invalid status', () => {
      const items = [
        { memberIdentifier: '13800138001', status: 'invalid_status', source: 'manual' },
      ];
      expect(() => VersionRules.validateSnapshot(items)).toThrow();
    });

    it('should accept empty snapshot', () => {
      expect(VersionRules.validateSnapshot([])).toBe(true);
    });
  });
});
