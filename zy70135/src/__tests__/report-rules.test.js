const ReportRules = require('../core/report-rules');
const { RISK_LEVEL } = require('../core/constants');

describe('ReportRules', () => {
  describe('validateReportParameters', () => {
    it('should accept valid parameters with correct date range', () => {
      const params = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      const result = ReportRules.validateReportParameters(params);
      expect(result.isValid).toBe(true);
    });

    it('should reject when endDate is before startDate', () => {
      const params = {
        startDate: '2024-01-31',
        endDate: '2024-01-01',
      };
      const result = ReportRules.validateReportParameters(params);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('开始时间');
    });

    it('should reject date range exceeding max days', () => {
      const params = {
        startDate: '2024-01-01',
        endDate: '2024-04-15',
      };
      const result = ReportRules.validateReportParameters(params);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('90');
    });

    it('should accept empty parameters', () => {
      const result = ReportRules.validateReportParameters({});
      expect(result.isValid).toBe(true);
    });

    it('should accept only startDate', () => {
      const result = ReportRules.validateReportParameters({ startDate: '2024-01-01' });
      expect(result.isValid).toBe(true);
    });

    it('should accept only endDate', () => {
      const result = ReportRules.validateReportParameters({ endDate: '2024-01-31' });
      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateRiskLevel', () => {
    it('should return low risk for no activity', () => {
      const result = ReportRules.calculateRiskLevel(0, 0, 0);
      expect(result).toBe(RISK_LEVEL.LOW);
    });

    it('should return medium risk with some hits', () => {
      const result = ReportRules.calculateRiskLevel(3, 1, 15);
      expect(result).toBe(RISK_LEVEL.MEDIUM);
    });

    it('should return medium risk with just one hit', () => {
      const result = ReportRules.calculateRiskLevel(1, 0, 0);
      expect(result).toBe(RISK_LEVEL.MEDIUM);
    });

    it('should return medium risk with moderate hits (8 hits = score 2)', () => {
      const result = ReportRules.calculateRiskLevel(8, 0, 0);
      expect(result).toBe(RISK_LEVEL.MEDIUM);
    });

    it('should return high risk with many hits (15 hits = score 3)', () => {
      const result = ReportRules.calculateRiskLevel(15, 0, 0);
      expect(result).toBe(RISK_LEVEL.HIGH);
    });

    it('should return critical risk with combined factors (score >= 5)', () => {
      const result = ReportRules.calculateRiskLevel(15, 4, 100);
      expect(result).toBe(RISK_LEVEL.CRITICAL);
    });

    it('should return high risk with combined factors', () => {
      const result = ReportRules.calculateRiskLevel(3, 2, 45);
      expect(result).toBe(RISK_LEVEL.HIGH);
    });

    it('should return critical risk with many exemptions', () => {
      const result = ReportRules.calculateRiskLevel(0, 5, 0);
      expect(result).toBe(RISK_LEVEL.MEDIUM);
    });

    it('should return medium risk with long duration', () => {
      const result = ReportRules.calculateRiskLevel(0, 0, 100);
      expect(result).toBe(RISK_LEVEL.MEDIUM);
    });
  });

  describe('calculateSyncMetrics', () => {
    it('should identify up-to-date version', () => {
      const versions = [
        { versionNumber: '1.0.0', status: 'published', createdAt: new Date('2024-01-01') },
      ];
      const result = ReportRules.calculateSyncMetrics('1.0.0', versions);
      expect(result.isSync).toBe(true);
    });

    it('should identify outdated version', () => {
      const now = new Date();
      const older = new Date(now.getTime() - 86400000);
      const versions = [
        { versionNumber: '1.0.0', status: 'published', createdAt: older, publishedAt: older },
        { versionNumber: '2.0.0', status: 'published', createdAt: now, publishedAt: now },
      ];
      const result = ReportRules.calculateSyncMetrics('1.0.0', versions);
      expect(result.isSync).toBe(false);
      expect(result.versionsBehind).toBe(1);
    });

    it('should handle no published versions', () => {
      const versions = [
        { versionNumber: '1.0.0', status: 'draft' },
      ];
      const result = ReportRules.calculateSyncMetrics('1.0.0', versions);
      expect(result.isSync).toBe(true);
      expect(result.latestSharedVersion).toBeNull();
    });

    it('should handle empty versions array', () => {
      const result = ReportRules.calculateSyncMetrics('1.0.0', []);
      expect(result.isSync).toBe(true);
      expect(result.latestSharedVersion).toBeNull();
    });

    it('should include latest published version info', () => {
      const publishedAt = new Date('2024-01-15');
      const versions = [
        { versionNumber: '2.0.0', status: 'published', createdAt: publishedAt, publishedAt },
      ];
      const result = ReportRules.calculateSyncMetrics('1.0.0', versions);
      expect(result.latestSharedVersion).toBe('2.0.0');
      expect(result.lastSyncAt).toBe(publishedAt);
    });
  });

  describe('generateAuditTrail', () => {
    it('should format audit trail correctly', () => {
      const logs = [
        {
          action: 'add',
          entityType: 'blacklist',
          entityId: 1,
          createdAt: new Date('2024-01-01T10:00:00'),
          actorName: '管理员',
          metadata: { reason: '恶意行为' },
        },
      ];
      const result = ReportRules.generateAuditTrail(logs);
      expect(result.length).toBe(1);
      expect(result[0].sequence).toBe(1);
      expect(result[0].action).toBe('add');
      expect(result[0].actor).toBe('管理员');
      expect(result[0].description).toBeDefined();
    });

    it('should handle empty logs', () => {
      const result = ReportRules.generateAuditTrail([]);
      expect(result.length).toBe(0);
    });

    it('should sort logs by time ascending', () => {
      const logs = [
        { action: 'add', createdAt: new Date('2024-01-01T10:00:00') },
        { action: 'remove', createdAt: new Date('2024-01-01T08:00:00') },
      ];
      const result = ReportRules.generateAuditTrail(logs);
      expect(result[0].action).toBe('remove');
      expect(result[1].action).toBe('add');
    });

    it('should assign correct sequence numbers', () => {
      const logs = [
        { action: 'add', createdAt: new Date('2024-01-01T08:00:00') },
        { action: 'update', createdAt: new Date('2024-01-01T09:00:00') },
        { action: 'remove', createdAt: new Date('2024-01-01T10:00:00') },
      ];
      const result = ReportRules.generateAuditTrail(logs);
      expect(result[0].sequence).toBe(1);
      expect(result[1].sequence).toBe(2);
      expect(result[2].sequence).toBe(3);
    });
  });

  describe('describeEvent', () => {
    it('should return description for known actions', () => {
      const event = { action: 'add', metadata: {} };
      const desc = ReportRules.describeEvent(event);
      expect(desc).toBe('加入黑名单');
    });

    it('should include metadata details when available', () => {
      const event = {
        action: 'add',
        metadata: { reason: '恶意行为' },
      };
      const desc = ReportRules.describeEvent(event);
      expect(desc).toContain('加入黑名单');
      expect(desc).toContain('恶意行为');
    });

    it('should return action name for unknown actions', () => {
      const event = { action: 'unknown_action' };
      const desc = ReportRules.describeEvent(event);
      expect(desc).toBe('unknown_action');
    });

    it('should include version number in description', () => {
      const event = {
        action: 'version_publish',
        metadata: { versionNumber: '2.0.0' },
      };
      const desc = ReportRules.describeEvent(event);
      expect(desc).toContain('2.0.0');
    });

    it('should include duration in description', () => {
      const event = {
        action: 'exemption_request',
        metadata: { durationDays: 30 },
      };
      const desc = ReportRules.describeEvent(event);
      expect(desc).toContain('30天');
    });
  });
});
