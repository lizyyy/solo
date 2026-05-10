import { dataStore } from '../src/repositories/DataStore';
import { targetSnapshotService } from '../src/services/TargetSnapshotService';
import { achievementService } from '../src/services/AchievementService';
import { OperatorInfo, Quarter, IncentiveTier } from '../src/models/types';
import { TargetType, TargetUnit, TierConfig } from '../src/models/TargetSnapshot';
import { AchievementSource, SourceType, SourceVerificationStatus } from '../src/models/AchievementRecord';

describe('AchievementService', () => {
  const operator: OperatorInfo = {
    operatorId: 'test-001',
    operatorName: '测试用户',
    operatorRole: 'TEST',
    timestamp: new Date()
  };

  const tierConfig: TierConfig[] = [
    {
      tier: IncentiveTier.TIER_1,
      minThreshold: 800000,
      maxThreshold: 999999,
      incentiveRate: 0.02,
      incentiveAmount: 16000,
      description: '基础达标'
    },
    {
      tier: IncentiveTier.TIER_2,
      minThreshold: 1000000,
      maxThreshold: 1199999,
      incentiveRate: 0.03,
      incentiveAmount: 30000,
      description: '良好达成'
    },
    {
      tier: IncentiveTier.TIER_3,
      minThreshold: 1200000,
      maxThreshold: 1499999,
      incentiveRate: 0.04,
      incentiveAmount: 48000,
      description: '优秀达成'
    }
  ];

  beforeEach(() => {
    dataStore.reset();
  });

  describe('创建达标记录', () => {
    it('应该成功创建达标记录并自动审核通过', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH001',
        channelName: '测试渠道',
        regionId: 'REG001',
        regionName: '测试区域',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '测试系统'
      }, operator);
      expect(snapshotResult.success).toBe(true);

      targetSnapshotService.finalizeSnapshot(snapshotResult.snapshot!.id, operator);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 1100000,
          sourceDate: new Date(),
          sourceReference: 'TEST-001',
          verificationStatus: SourceVerificationStatus.VERIFIED
        }
      ];

      const result = achievementService.createAchievementRecord({
        channelId: 'CH001',
        channelName: '测试渠道',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1100000,
        achievementSources
      }, operator);

      expect(result.success).toBe(true);
      expect(result.record!.isAchieved).toBe(true);
      expect(result.record!.achievedTier).toBe(IncentiveTier.TIER_2);
      expect(result.record!.achievementRate).toBe(1.1);
    });

    it('应该在达成率超过200%时进入人工复核', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH002',
        channelName: '测试渠道2',
        regionId: 'REG001',
        regionName: '测试区域',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '测试系统'
      }, operator);
      targetSnapshotService.finalizeSnapshot(snapshotResult.snapshot!.id, operator);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 2500000,
          sourceDate: new Date(),
          sourceReference: 'TEST-002',
          verificationStatus: SourceVerificationStatus.VERIFIED
        }
      ];

      const result = achievementService.createAchievementRecord({
        channelId: 'CH002',
        channelName: '测试渠道2',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 2500000,
        achievementSources
      }, operator);

      expect(result.success).toBe(true);
      expect(result.needsManualReview).toBe(true);
      expect(result.manualReviewReason).toContain('达成率超过200%');
    });

    it('应该在存在未验证数据源时进入人工复核', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH003',
        channelName: '测试渠道3',
        regionId: 'REG001',
        regionName: '测试区域',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '测试系统'
      }, operator);
      targetSnapshotService.finalizeSnapshot(snapshotResult.snapshot!.id, operator);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 1100000,
          sourceDate: new Date(),
          sourceReference: 'TEST-003',
          verificationStatus: SourceVerificationStatus.PENDING_VERIFICATION
        }
      ];

      const result = achievementService.createAchievementRecord({
        channelId: 'CH003',
        channelName: '测试渠道3',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1100000,
        achievementSources
      }, operator);

      expect(result.success).toBe(true);
      expect(result.needsManualReview).toBe(true);
      expect(result.manualReviewReason).toContain('未验证的数据源');
    });

    it('应该在金额差异超过5%时进入人工复核', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH004',
        channelName: '测试渠道4',
        regionId: 'REG001',
        regionName: '测试区域',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '测试系统'
      }, operator);
      targetSnapshotService.finalizeSnapshot(snapshotResult.snapshot!.id, operator);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 1000000,
          sourceDate: new Date(),
          sourceReference: 'TEST-004',
          verificationStatus: SourceVerificationStatus.VERIFIED
        }
      ];

      const result = achievementService.createAchievementRecord({
        channelId: 'CH004',
        channelName: '测试渠道4',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1100000,
        achievementSources
      }, operator);

      expect(result.success).toBe(true);
      expect(result.needsManualReview).toBe(true);
      expect(result.manualReviewReason).toContain('差异超过5%');
    });
  });

  describe('重复提交保护', () => {
    it('应该阻止重复提交已存在的达标记录', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH005',
        channelName: '测试渠道5',
        regionId: 'REG001',
        regionName: '测试区域',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '测试系统'
      }, operator);
      targetSnapshotService.finalizeSnapshot(snapshotResult.snapshot!.id, operator);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 1100000,
          sourceDate: new Date(),
          sourceReference: 'TEST-005',
          verificationStatus: SourceVerificationStatus.VERIFIED
        }
      ];

      const firstResult = achievementService.createAchievementRecord({
        channelId: 'CH005',
        channelName: '测试渠道5',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1100000,
        achievementSources
      }, operator);
      expect(firstResult.success).toBe(true);

      const secondResult = achievementService.createAchievementRecord({
        channelId: 'CH005',
        channelName: '测试渠道5',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1150000,
        achievementSources
      }, operator);

      expect(secondResult.success).toBe(false);
      expect(secondResult.errorMessage).toContain('不能重复提交');
    });
  });

  describe('目标快照锁定检查', () => {
    it('应该拒绝使用未锁定的目标快照', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH006',
        channelName: '测试渠道6',
        regionId: 'REG001',
        regionName: '测试区域',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '测试系统'
      }, operator);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 1100000,
          sourceDate: new Date(),
          sourceReference: 'TEST-006',
          verificationStatus: SourceVerificationStatus.VERIFIED
        }
      ];

      const result = achievementService.createAchievementRecord({
        channelId: 'CH006',
        channelName: '测试渠道6',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1100000,
        achievementSources
      }, operator);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('尚未锁定');
    });
  });
});
