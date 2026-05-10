const BlacklistRules = require('../core/blacklist-rules');
const { BLACKLIST_STATUS, EXEMPTION_STATUS } = require('../core/constants');

describe('BlacklistRules', () => {
  describe('validateReasonLength', () => {
    it('should accept valid reason within length limit', () => {
      expect(BlacklistRules.validateReasonLength('这是一个有效的原因描述')).toBe(true);
    });

    it('should throw error when reason is too long', () => {
      const longReason = 'a'.repeat(600);
      expect(() => BlacklistRules.validateReasonLength(longReason)).toThrow();
    });

    it('should accept reason with exactly max length', () => {
      const reason = 'a'.repeat(500);
      expect(BlacklistRules.validateReasonLength(reason)).toBe(true);
    });

    it('should accept empty or undefined reason', () => {
      expect(BlacklistRules.validateReasonLength('')).toBe(true);
      expect(BlacklistRules.validateReasonLength(undefined)).toBe(true);
    });
  });

  describe('canBeRemoved', () => {
    it('should allow removal of active record without exemption', () => {
      expect(BlacklistRules.canBeRemoved(BLACKLIST_STATUS.ACTIVE, false)).toBe(true);
    });

    it('should allow removal of manually corrected record', () => {
      expect(BlacklistRules.canBeRemoved(BLACKLIST_STATUS.MANUALLY_CORRECTED, false)).toBe(true);
    });

    it('should NOT allow removal of record with active exemption', () => {
      expect(() => BlacklistRules.canBeRemoved(BLACKLIST_STATUS.ACTIVE, true)).toThrow();
    });

    it('should allow removal of inactive record (no restriction)', () => {
      expect(BlacklistRules.canBeRemoved(BLACKLIST_STATUS.INACTIVE, false)).toBe(true);
    });
  });

  describe('canBeManuallyCorrected', () => {
    it('should allow manual correction of active record', () => {
      expect(BlacklistRules.canBeManuallyCorrected(BLACKLIST_STATUS.ACTIVE, 'admin')).toBe(true);
    });

    it('should allow manual correction of exempted record', () => {
      expect(BlacklistRules.canBeManuallyCorrected(BLACKLIST_STATUS.EXEMPTED, 'admin')).toBe(true);
    });

    it('should allow manual correction of inactive record', () => {
      expect(BlacklistRules.canBeManuallyCorrected(BLACKLIST_STATUS.INACTIVE, 'admin')).toBe(true);
    });

    it('should NOT allow correction of already manually corrected record', () => {
      expect(() => BlacklistRules.canBeManuallyCorrected(BLACKLIST_STATUS.MANUALLY_CORRECTED, 'admin')).toThrow();
    });
  });

  describe('determineEffectiveStatus', () => {
    it('should return manually_corrected when record is manually corrected', () => {
      const result = BlacklistRules.determineEffectiveStatus(
        BLACKLIST_STATUS.MANUALLY_CORRECTED,
        false,
        null
      );
      expect(result).toBe(BLACKLIST_STATUS.MANUALLY_CORRECTED);
    });

    it('should return exempted when has active approved exemption', () => {
      const result = BlacklistRules.determineEffectiveStatus(
        BLACKLIST_STATUS.ACTIVE,
        true,
        EXEMPTION_STATUS.APPROVED
      );
      expect(result).toBe(BLACKLIST_STATUS.EXEMPTED);
    });

    it('should return original status when no exemption', () => {
      const result = BlacklistRules.determineEffectiveStatus(
        BLACKLIST_STATUS.ACTIVE,
        false,
        null
      );
      expect(result).toBe(BLACKLIST_STATUS.ACTIVE);
    });

    it('should return original status when exemption is rejected', () => {
      const result = BlacklistRules.determineEffectiveStatus(
        BLACKLIST_STATUS.ACTIVE,
        true,
        EXEMPTION_STATUS.REJECTED
      );
      expect(result).toBe(BLACKLIST_STATUS.ACTIVE);
    });
  });

  describe('isHit', () => {
    it('should be hit for active member without exemption', () => {
      const result = BlacklistRules.isHit(
        '13800138001',
        BLACKLIST_STATUS.ACTIVE,
        false,
        false
      );
      expect(result).toBe(true);
    });

    it('should NOT be hit for inactive member', () => {
      const result = BlacklistRules.isHit(
        '13800138001',
        BLACKLIST_STATUS.INACTIVE,
        false,
        false
      );
      expect(result).toBe(false);
    });

    it('should NOT be hit when has active exemption', () => {
      const result = BlacklistRules.isHit(
        '13800138001',
        BLACKLIST_STATUS.ACTIVE,
        true,
        false
      );
      expect(result).toBe(false);
    });

    it('should NOT be hit when record is manually corrected', () => {
      const result = BlacklistRules.isHit(
        '13800138001',
        BLACKLIST_STATUS.MANUALLY_CORRECTED,
        false,
        true
      );
      expect(result).toBe(false);
    });

    it('should NOT be hit when member not in blacklist', () => {
      const result = BlacklistRules.isHit(null, null, false, false);
      expect(result).toBe(false);
    });

    it('should NOT be hit when memberIdentifier is empty', () => {
      const result = BlacklistRules.isHit('', BLACKLIST_STATUS.ACTIVE, false, false);
      expect(result).toBe(false);
    });
  });

  describe('validateSyncStatus', () => {
    it('should return isSync=true when versions match', () => {
      const result = BlacklistRules.validateSyncStatus('1.0.0', '1.0.0');
      expect(result.isSync).toBe(true);
      expect(result.needsSync).toBe(false);
    });

    it('should return needsSync=true when versions differ', () => {
      const result = BlacklistRules.validateSyncStatus('1.0.0', '2.0.0');
      expect(result.isSync).toBe(false);
      expect(result.needsSync).toBe(true);
      expect(result.currentVersion).toBe('1.0.0');
      expect(result.targetVersion).toBe('2.0.0');
    });
  });

  describe('calculateStatusChangeReason', () => {
    it('should generate status change reason with all components', () => {
      const reason = BlacklistRules.calculateStatusChangeReason(
        BLACKLIST_STATUS.ACTIVE,
        BLACKLIST_STATUS.INACTIVE,
        '管理员'
      );
      expect(reason).toContain('active');
      expect(reason).toContain('inactive');
      expect(reason).toContain('管理员');
    });

    it('should handle no status change', () => {
      const reason = BlacklistRules.calculateStatusChangeReason(
        BLACKLIST_STATUS.ACTIVE,
        BLACKLIST_STATUS.ACTIVE,
        '管理员'
      );
      expect(reason).not.toContain('状态变更');
    });
  });
});
