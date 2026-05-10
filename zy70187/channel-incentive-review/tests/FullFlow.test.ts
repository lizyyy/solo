import { dataStore } from '../src/repositories/DataStore';
import { targetSnapshotService } from '../src/services/TargetSnapshotService';
import { achievementService } from '../src/services/AchievementService';
import { protectionPeriodService } from '../src/services/ProtectionPeriodService';
import { disputeService } from '../src/services/DisputeService';
import { incentiveCalculationService } from '../src/services/IncentiveCalculationService';
import { OperatorInfo, Quarter, IncentiveTier, DisputeReason, ChannelIncentiveStatus } from '../src/models/types';
import { TargetType, TargetUnit, TierConfig } from '../src/models/TargetSnapshot';
import { AchievementSource, SourceType, SourceVerificationStatus } from '../src/models/AchievementRecord';
import { ProtectionType, ProtectionReason, ProtectionTerms } from '../src/models/ProtectionPeriod';
import { DisputeType, DisputeDetails, ResolutionType } from '../src/models/Dispute';
import { auditLogger } from '../src/utils/AuditLogger';

describe('完整业务流程测试', () => {
  const operator: OperatorInfo = {
    operatorId: 'OP001',
    operatorName: '张三',
    operatorRole: 'SALES_MANAGER',
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

  describe('完整正向流程', () => {
    it('应该完成从目标快照到付款的完整流程', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH-FULL-001',
        channelName: '完整流程测试渠道',
        regionId: 'REG001',
        regionName: '华东区',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '年度目标系统'
      }, operator);
      expect(snapshotResult.success).toBe(true);

      const finalizeResult = targetSnapshotService.finalizeSnapshot(
        snapshotResult.snapshot!.id,
        operator
      );
      expect(finalizeResult.success).toBe(true);
      expect(finalizeResult.snapshot!.isFinalized).toBe(true);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 1250000,
          sourceDate: new Date(),
          sourceReference: 'INV-2024-Q1-001',
          verificationStatus: SourceVerificationStatus.VERIFIED
        }
      ];

      const achievementResult = achievementService.createAchievementRecord({
        channelId: 'CH-FULL-001',
        channelName: '完整流程测试渠道',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1250000,
        achievementSources
      }, operator);

      expect(achievementResult.success).toBe(true);
      expect(achievementResult.record!.isAchieved).toBe(true);
      expect(achievementResult.record!.achievedTier).toBe(IncentiveTier.TIER_3);

      const incentiveResult = incentiveCalculationService.calculateIncentive({
        achievementRecordId: achievementResult.record!.id
      }, operator);

      expect(incentiveResult.success).toBe(true);
      expect(incentiveResult.incentiveDetail!.finalIncentiveAmount).toBe(48000);
      expect(incentiveResult.incentiveDetail!.tier).toBe(IncentiveTier.TIER_3);

      const history = auditLogger.getEntityHistory(
        'AchievementRecord',
        achievementResult.record!.id
      );
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toContain('张三');
    });
  });

  describe('争议处理流程', () => {
    it('应该完整处理争议并记录历史', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH-DISPUTE-001',
        channelName: '争议测试渠道',
        regionId: 'REG001',
        regionName: '华东区',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '年度目标系统'
      }, operator);
      targetSnapshotService.finalizeSnapshot(snapshotResult.snapshot!.id, operator);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 1100000,
          sourceDate: new Date(),
          sourceReference: 'INV-2024-Q1-002',
          verificationStatus: SourceVerificationStatus.VERIFIED
        }
      ];

      const achievementResult = achievementService.createAchievementRecord({
        channelId: 'CH-DISPUTE-001',
        channelName: '争议测试渠道',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1100000,
        achievementSources
      }, operator);

      expect(achievementResult.success).toBe(true);
      expect(achievementResult.record!.currentStatus).toBe(ChannelIncentiveStatus.VERIFIED);

      const disputeDetails: DisputeDetails = {
        description: '实际达成金额应为130万',
        expectedOutcome: '调整到TIER_3',
        affectedItems: [
          {
            itemType: 'ACHIEVEMENT_AMOUNT',
            itemId: achievementResult.record!.id,
            itemDescription: '达成金额',
            currentValue: '1100000',
            expectedValue: '1300000'
          }
        ]
      };

      const raiseResult = disputeService.raiseDispute({
        achievementRecordId: achievementResult.record!.id,
        disputeType: DisputeType.ACHIEVEMENT_AMOUNT,
        disputeReason: DisputeReason.ACHIEVEMENT_CRITERIA_DISAGREEMENT,
        disputeDetails
      }, operator);

      expect(raiseResult.success).toBe(true);
      expect(raiseResult.dispute!.currentStatus).toBe('OPEN');

      const assignResult = disputeService.assignDispute(
        raiseResult.dispute!.id,
        'OP002',
        operator
      );
      expect(assignResult.success).toBe(true);
      expect(assignResult.dispute!.currentStatus).toBe('ASSIGNED');

      const startReviewResult = disputeService.startReview(
        raiseResult.dispute!.id,
        {
          operatorId: 'OP002',
          operatorName: '李四',
          operatorRole: 'REVIEWER',
          timestamp: new Date()
        }
      );
      expect(startReviewResult.success).toBe(true);
      expect(startReviewResult.dispute!.currentStatus).toBe('UNDER_REVIEW');

      const resolveResult = disputeService.resolveDispute(
        raiseResult.dispute!.id,
        {
          resolutionType: ResolutionType.REJECTED,
          resolutionDetails: '经核实，金额无误',
          impact: {
            statusChange: false,
            newStatus: null,
            amountAdjustment: 0,
            tierAdjustment: null,
            notes: '争议被驳回'
          }
        },
        {
          operatorId: 'OP002',
          operatorName: '李四',
          operatorRole: 'REVIEWER',
          timestamp: new Date()
        }
      );

      expect(resolveResult.success).toBe(true);
      expect(resolveResult.dispute!.currentStatus).toBe('RESOLVED');

      const disputeHistory = auditLogger.getEntityHistory(
        'Dispute',
        raiseResult.dispute!.id
      );
      expect(disputeHistory.length).toBeGreaterThan(0);
    });

    it('应该阻止对同一记录重复提出未解决的争议', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH-DISPUTE-002',
        channelName: '重复争议测试渠道',
        regionId: 'REG001',
        regionName: '华东区',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '年度目标系统'
      }, operator);
      targetSnapshotService.finalizeSnapshot(snapshotResult.snapshot!.id, operator);

      const achievementSources: AchievementSource[] = [
        {
          sourceSystem: 'ERP',
          sourceType: SourceType.SALES_RECORD,
          sourceAmount: 1100000,
          sourceDate: new Date(),
          sourceReference: 'INV-2024-Q1-003',
          verificationStatus: SourceVerificationStatus.VERIFIED
        }
      ];

      const achievementResult = achievementService.createAchievementRecord({
        channelId: 'CH-DISPUTE-002',
        channelName: '重复争议测试渠道',
        year: 2024,
        quarter: Quarter.Q1,
        targetSnapshotId: snapshotResult.snapshot!.id,
        achievementAmount: 1100000,
        achievementSources
      }, operator);

      const disputeDetails: DisputeDetails = {
        description: '测试争议',
        expectedOutcome: '测试',
        affectedItems: []
      };

      const firstDispute = disputeService.raiseDispute({
        achievementRecordId: achievementResult.record!.id,
        disputeType: DisputeType.ACHIEVEMENT_AMOUNT,
        disputeReason: DisputeReason.ACHIEVEMENT_CRITERIA_DISAGREEMENT,
        disputeDetails
      }, operator);
      expect(firstDispute.success).toBe(true);

      const secondDispute = disputeService.raiseDispute({
        achievementRecordId: achievementResult.record!.id,
        disputeType: DisputeType.TIER_CALCULATION,
        disputeReason: DisputeReason.TIER_CALCULATION_DISAGREEMENT,
        disputeDetails
      }, operator);

      expect(secondDispute.success).toBe(false);
      expect(secondDispute.errorMessage).toContain('未解决的争议');
    });
  });

  describe('保护期功能', () => {
    it('应该阻止同一渠道同一季度创建多个活跃保护期', () => {
      const protectionTerms: ProtectionTerms = {
        protectedTier: IncentiveTier.TIER_2,
        protectedThreshold: null,
        protectedRate: null,
        protectedAmount: null,
        applicationRules: []
      };

      const firstProtection = protectionPeriodService.createProtectionPeriod({
        channelId: 'CH-PROT-001',
        channelName: '保护期测试渠道',
        year: 2024,
        quarter: Quarter.Q1,
        protectionType: ProtectionType.TIER_PROTECTION,
        protectionReason: ProtectionReason.NEW_CHANNEL,
        effectiveStartDate: new Date('2024-01-01'),
        effectiveEndDate: new Date('2024-03-31'),
        protectionTerms
      }, operator);
      expect(firstProtection.success).toBe(true);

      const secondProtection = protectionPeriodService.createProtectionPeriod({
        channelId: 'CH-PROT-001',
        channelName: '保护期测试渠道',
        year: 2024,
        quarter: Quarter.Q1,
        protectionType: ProtectionType.RATE_PROTECTION,
        protectionReason: ProtectionReason.STRATEGIC_IMPORTANCE,
        effectiveStartDate: new Date('2024-01-15'),
        effectiveEndDate: new Date('2024-03-15'),
        protectionTerms: {
          ...protectionTerms,
          protectedTier: null,
          protectedRate: 0.05
        }
      }, operator);

      expect(secondProtection.success).toBe(false);
      expect(secondProtection.errorMessage).toContain('已存在活跃的保护期');
    });
  });

  describe('审计日志', () => {
    it('应该记录所有操作并提供人类可读的历史', () => {
      const snapshotResult = targetSnapshotService.createSnapshot({
        channelId: 'CH-LOG-001',
        channelName: '日志测试渠道',
        regionId: 'REG001',
        regionName: '华东区',
        year: 2024,
        quarter: Quarter.Q1,
        targetType: TargetType.REVENUE,
        targetAmount: 1000000,
        targetUnit: TargetUnit.CURRENCY,
        tierConfig,
        snapshotSource: '测试'
      }, operator);

      targetSnapshotService.finalizeSnapshot(snapshotResult.snapshot!.id, operator);

      const history = auditLogger.getEntityHistory(
        'TargetSnapshot',
        snapshotResult.snapshot!.id
      );

      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toContain('张三');
      expect(history[0]).toContain('CREATE_SNAPSHOT');
    });
  });
});
