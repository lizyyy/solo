const ExemptionRules = require('../core/exemption-rules');
const { EXEMPTION_TYPE, EXEMPTION_STATUS, BLACKLIST_STATUS } = require('../core/constants');

describe('ExemptionRules', () => {
  describe('validateDuration', () => {
    it('should accept valid temporary duration', () => {
      expect(ExemptionRules.validateDuration(30, EXEMPTION_TYPE.TEMPORARY)).toBe(true);
    });

    it('should throw error for duration exceeding max', () => {
      expect(() => ExemptionRules.validateDuration(100, EXEMPTION_TYPE.TEMPORARY)).toThrow();
    });

    it('should throw error for negative duration', () => {
      expect(() => ExemptionRules.validateDuration(-5, EXEMPTION_TYPE.TEMPORARY)).toThrow();
    });

    it('should throw error for zero duration', () => {
      expect(() => ExemptionRules.validateDuration(0, EXEMPTION_TYPE.TEMPORARY)).toThrow();
    });

    it('should accept valid emergency duration', () => {
      expect(ExemptionRules.validateDuration(7, EXEMPTION_TYPE.EMERGENCY)).toBe(true);
    });

    it('should always accept permanent type regardless of duration', () => {
      expect(ExemptionRules.validateDuration(9999, EXEMPTION_TYPE.PERMANENT)).toBe(true);
    });

    it('should default to temporary type if not specified', () => {
      expect(ExemptionRules.validateDuration(30)).toBe(true);
    });
  });

  describe('validateExemptionReason', () => {
    it('should accept valid reason', () => {
      expect(ExemptionRules.validateExemptionReason('用户有特殊情况需要临时豁免')).toBe(true);
    });

    it('should reject too short reason', () => {
      expect(() => ExemptionRules.validateExemptionReason('短')).toThrow();
    });

    it('should reject empty reason', () => {
      expect(() => ExemptionRules.validateExemptionReason('')).toThrow();
    });

    it('should reject whitespace-only reason', () => {
      expect(() => ExemptionRules.validateExemptionReason('   ')).toThrow();
    });

    it('should reject too long reason', () => {
      const longReason = 'a'.repeat(1001);
      expect(() => ExemptionRules.validateExemptionReason(longReason)).toThrow();
    });

    it('should accept reason at exactly max length', () => {
      const reason = 'a'.repeat(1000);
      expect(ExemptionRules.validateExemptionReason(reason)).toBe(true);
    });
  });

  describe('canRequestExemption', () => {
    it('should allow exemption request for active record', () => {
      expect(ExemptionRules.canRequestExemption(BLACKLIST_STATUS.ACTIVE, false, false)).toBe(true);
    });

    it('should NOT allow request for manually corrected record', () => {
      expect(() => ExemptionRules.canRequestExemption(BLACKLIST_STATUS.ACTIVE, false, true)).toThrow();
    });

    it('should NOT allow request when has active exemption', () => {
      expect(() => ExemptionRules.canRequestExemption(BLACKLIST_STATUS.ACTIVE, true, false)).toThrow();
    });
  });

  describe('canApprove', () => {
    it('should allow approver to approve pending exemption from different role', () => {
      expect(ExemptionRules.canApprove(EXEMPTION_STATUS.PENDING, 'operator', 'approver')).toBe(true);
    });

    it('should allow admin to approve pending exemption from any role', () => {
      expect(ExemptionRules.canApprove(EXEMPTION_STATUS.PENDING, 'admin', 'admin')).toBe(true);
    });

    it('should NOT allow approval of already approved exemption', () => {
      expect(() => ExemptionRules.canApprove(EXEMPTION_STATUS.APPROVED, 'operator', 'approver')).toThrow();
    });

    it('should NOT allow approval of rejected exemption', () => {
      expect(() => ExemptionRules.canApprove(EXEMPTION_STATUS.REJECTED, 'operator', 'approver')).toThrow();
    });

    it('should NOT allow same non-admin role to approve their own request', () => {
      expect(() => ExemptionRules.canApprove(EXEMPTION_STATUS.PENDING, 'approver', 'approver')).toThrow();
    });
  });

  describe('canReject', () => {
    it('should allow rejection of pending exemption', () => {
      expect(ExemptionRules.canReject(EXEMPTION_STATUS.PENDING)).toBe(true);
    });

    it('should NOT allow rejection of already approved exemption', () => {
      expect(() => ExemptionRules.canReject(EXEMPTION_STATUS.APPROVED)).toThrow();
    });

    it('should NOT allow rejection of rejected exemption', () => {
      expect(() => ExemptionRules.canReject(EXEMPTION_STATUS.REJECTED)).toThrow();
    });
  });

  describe('canRevoke', () => {
    it('should allow admin to revoke approved exemption', () => {
      expect(ExemptionRules.canRevoke(EXEMPTION_STATUS.APPROVED, true)).toBe(true);
    });

    it('should allow admin to revoke pending exemption', () => {
      expect(ExemptionRules.canRevoke(EXEMPTION_STATUS.PENDING, true)).toBe(true);
    });

    it('should NOT allow non-admin to revoke', () => {
      expect(() => ExemptionRules.canRevoke(EXEMPTION_STATUS.APPROVED, false)).toThrow();
    });

    it('should NOT allow revocation of rejected exemption', () => {
      expect(() => ExemptionRules.canRevoke(EXEMPTION_STATUS.REJECTED, true)).toThrow();
    });

    it('should NOT allow revocation of expired exemption', () => {
      expect(() => ExemptionRules.canRevoke(EXEMPTION_STATUS.EXPIRED, true)).toThrow();
    });
  });

  describe('calculateExpiryDate', () => {
    it('should calculate correct expiry date', () => {
      const startDate = new Date('2024-01-01');
      const expiryDate = ExemptionRules.calculateExpiryDate(startDate, 30);
      expect(expiryDate.toISOString().split('T')[0]).toBe('2024-01-31');
    });

    it('should use current date if startDate not provided', () => {
      const expiryDate = ExemptionRules.calculateExpiryDate(null, 30);
      expect(expiryDate).toBeDefined();
    });
  });

  describe('isExpired', () => {
    it('should return true when expiry date is past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(ExemptionRules.isExpired(pastDate)).toBe(true);
    });

    it('should return false when expiry date is future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      expect(ExemptionRules.isExpired(futureDate)).toBe(false);
    });

    it('should use provided currentDate', () => {
      const expiryDate = new Date('2024-01-15');
      const currentDate = new Date('2024-01-10');
      expect(ExemptionRules.isExpired(expiryDate, currentDate)).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should be active for approved permanent exemption', () => {
      const exemption = {
        status: EXEMPTION_STATUS.APPROVED,
        type: EXEMPTION_TYPE.PERMANENT,
      };
      expect(ExemptionRules.isActive(exemption)).toBe(true);
    });

    it('should be active for approved temporary exemption not expired', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const exemption = {
        status: EXEMPTION_STATUS.APPROVED,
        type: EXEMPTION_TYPE.TEMPORARY,
        expiryDate: futureDate,
      };
      expect(ExemptionRules.isActive(exemption)).toBe(true);
    });

    it('should NOT be active for expired temporary exemption', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const exemption = {
        status: EXEMPTION_STATUS.APPROVED,
        type: EXEMPTION_TYPE.TEMPORARY,
        expiryDate: pastDate,
      };
      expect(ExemptionRules.isActive(exemption)).toBe(false);
    });

    it('should NOT be active for pending exemption', () => {
      const exemption = {
        status: EXEMPTION_STATUS.PENDING,
        type: EXEMPTION_TYPE.TEMPORARY,
      };
      expect(ExemptionRules.isActive(exemption)).toBe(false);
    });

    it('should NOT be active for rejected exemption', () => {
      const exemption = {
        status: EXEMPTION_STATUS.REJECTED,
        type: EXEMPTION_TYPE.TEMPORARY,
      };
      expect(ExemptionRules.isActive(exemption)).toBe(false);
    });

    it('should use provided currentDate', () => {
      const expiryDate = new Date('2024-01-15');
      const currentDate = new Date('2024-01-10');
      const exemption = {
        status: EXEMPTION_STATUS.APPROVED,
        type: EXEMPTION_TYPE.TEMPORARY,
        expiryDate,
      };
      expect(ExemptionRules.isActive(exemption, currentDate)).toBe(true);
    });
  });

  describe('needsReview', () => {
    it('should need review when past review period', () => {
      const approvedAt = new Date();
      approvedAt.setDate(approvedAt.getDate() - 10);
      const exemption = {
        approvedAt,
        type: EXEMPTION_TYPE.TEMPORARY,
      };
      expect(ExemptionRules.needsReview(exemption)).toBe(true);
    });

    it('should NOT need review when within review period', () => {
      const approvedAt = new Date();
      approvedAt.setDate(approvedAt.getDate() - 3);
      const exemption = {
        approvedAt,
        type: EXEMPTION_TYPE.TEMPORARY,
      };
      expect(ExemptionRules.needsReview(exemption)).toBe(false);
    });

    it('should NOT need review for permanent exemption', () => {
      const exemption = {
        type: EXEMPTION_TYPE.PERMANENT,
      };
      expect(ExemptionRules.needsReview(exemption)).toBe(false);
    });

    it('should use provided currentDate', () => {
      const approvedAt = new Date('2024-01-01');
      const currentDate = new Date('2024-01-15');
      const exemption = {
        approvedAt,
        type: EXEMPTION_TYPE.TEMPORARY,
      };
      expect(ExemptionRules.needsReview(exemption, currentDate)).toBe(true);
    });
  });
});
