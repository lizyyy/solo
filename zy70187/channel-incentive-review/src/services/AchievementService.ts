import { dataStore } from '../repositories/DataStore';
import { auditLogger, LogModule } from '../utils/AuditLogger';
import { OperatorInfo, ChannelIncentiveStatus, StatusChangeLog } from '../models/types';
import { 
  AchievementRecord, 
  VerificationStatus, 
  VerificationMethod, 
  TierCalculationDetails,
  AchievementSource,
  CalculationBreakdownItem
} from '../models/AchievementRecord';
import { TargetSnapshot, TierConfig } from '../models/TargetSnapshot';
import { Quarter, IncentiveTier } from '../models/types';
import { stateMachineEngine } from '../state-machine/StateMachineEngine';

export interface CreateAchievementRecordRequest {
  channelId: string;
  channelName: string;
  year: number;
  quarter: Quarter;
  targetSnapshotId: string;
  achievementAmount: number;
  achievementSources: AchievementSource[];
  notes?: string;
}

export interface AchievementResult {
  success: boolean;
  record?: AchievementRecord;
  errorMessage?: string;
  warningMessages?: string[];
  needsManualReview?: boolean;
  manualReviewReason?: string;
}

export class AchievementService {
  public createAchievementRecord(
    request: CreateAchievementRecordRequest, 
    operator: OperatorInfo
  ): AchievementResult {
    const warnings: string[] = [];
    
    const targetSnapshot = dataStore.targetSnapshots.findById(request.targetSnapshotId);
    if (!targetSnapshot) {
      return {
        success: false,
        errorMessage: `目标快照不存在：${request.targetSnapshotId}`
      };
    }

    if (!targetSnapshot.isFinalized) {
      return {
        success: false,
        errorMessage: '目标快照尚未锁定，不能创建达标记录。请先锁定目标快照。'
      };
    }

    const existingRecord = dataStore.achievementRecords.findAll().find(
      r => r.channelId === request.channelId && 
           r.year === request.year && 
           r.quarter === request.quarter
    );

    if (existingRecord) {
      if (existingRecord.currentStatus !== ChannelIncentiveStatus.INITIAL &&
          existingRecord.currentStatus !== ChannelIncentiveStatus.REJECTED) {
        return {
          success: false,
          errorMessage: `该渠道(${request.channelId})在${request.year}年${request.quarter}的达标记录已存在且处于${existingRecord.currentStatus}状态，不能重复提交。如需修改，请先将状态改为「已拒绝」或「初始状态」。`
        };
      }
      warnings.push(`该渠道在${request.year}年${request.quarter}已存在达标记录，将覆盖旧记录`);
    }

    const achievementRate = request.achievementAmount / targetSnapshot.targetAmount;
    const { isAchieved, achievedTier, tierCalculationDetails } = this.calculateTier(
      request.achievementAmount,
      targetSnapshot
    );

    const record = dataStore.achievementRecords.create({
      channelId: request.channelId,
      channelName: request.channelName,
      year: request.year,
      quarter: request.quarter,
      targetSnapshotId: request.targetSnapshotId,
      targetSnapshot,
      achievementAmount: request.achievementAmount,
      achievementRate,
      isAchieved,
      achievedTier,
      tierCalculationDetails,
      verificationStatus: VerificationStatus.PENDING,
      verificationMethod: null,
      verifiedAt: null,
      verifiedBy: null,
      achievementSources: request.achievementSources,
      exclusionReasons: [],
      currentStatus: ChannelIncentiveStatus.INITIAL,
      statusHistory: [],
      notes: request.notes || ''
    });

    auditLogger.log({
      module: LogModule.ACHIEVEMENT_RECORD,
      operation: 'CREATE_RECORD',
      operator,
      targetEntityType: 'AchievementRecord',
      targetEntityId: record.id,
      afterState: { ...record },
      success: true,
      reason: `创建渠道${request.channelId}的${request.year}年${request.quarter}达标记录，金额：${request.achievementAmount}`
    });

    const autoVerifyResult = this.autoVerify(record, operator, targetSnapshot);
    
    return {
      success: true,
      record: autoVerifyResult.record,
      warningMessages: warnings,
      needsManualReview: autoVerifyResult.needsManualReview,
      manualReviewReason: autoVerifyResult.manualReviewReason
    };
  }

  private autoVerify(
    record: AchievementRecord,
    operator: OperatorInfo,
    targetSnapshot: TargetSnapshot
  ): AchievementResult {
    const verificationResult = this.checkAutoVerificationCriteria(record, targetSnapshot);
    
    if (verificationResult.needsManualReview) {
      const transitionResult = stateMachineEngine.transition({
        fromStatus: record.currentStatus,
        toStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        operator,
        reason: verificationResult.reason || '需要人工复核'
      });

      if (transitionResult.success && transitionResult.statusChange) {
        const updatedRecord = dataStore.achievementRecords.update(record.id, {
          currentStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
          statusHistory: [...record.statusHistory, transitionResult.statusChange]
        });

        auditLogger.log({
          module: LogModule.STATE_TRANSITION,
          operation: 'STATE_CHANGE',
          operator,
          targetEntityType: 'AchievementRecord',
          targetEntityId: record.id,
          beforeState: { status: record.currentStatus },
          afterState: { status: ChannelIncentiveStatus.MANUAL_REVIEW },
          success: true,
          reason: verificationResult.reason || '需要人工复核'
        });

        return {
          success: true,
          record: updatedRecord,
          needsManualReview: true,
          manualReviewReason: verificationResult.reason
        };
      }
    }

    const transitionResult = stateMachineEngine.transition({
      fromStatus: record.currentStatus,
      toStatus: ChannelIncentiveStatus.VERIFIED,
      operator,
      reason: '自动审核通过'
    });

    if (transitionResult.success && transitionResult.statusChange) {
      const updatedRecord = dataStore.achievementRecords.update(record.id, {
        verificationStatus: VerificationStatus.AUTO_VERIFIED,
        verificationMethod: VerificationMethod.DATA_MATCH,
        verifiedAt: new Date(),
        verifiedBy: 'SYSTEM',
        currentStatus: ChannelIncentiveStatus.VERIFIED,
        statusHistory: [...record.statusHistory, transitionResult.statusChange]
      });

      auditLogger.log({
        module: LogModule.ACHIEVEMENT_RECORD,
        operation: 'AUTO_VERIFY',
        operator,
        targetEntityType: 'AchievementRecord',
        targetEntityId: record.id,
        beforeState: { 
          verificationStatus: record.verificationStatus,
          status: record.currentStatus
        },
        afterState: { 
          verificationStatus: VerificationStatus.AUTO_VERIFIED,
          status: ChannelIncentiveStatus.VERIFIED
        },
        success: true,
        reason: '自动审核通过'
      });

      return {
        success: true,
        record: updatedRecord
      };
    }

    return {
      success: true,
      record
    };
  }

  private checkAutoVerificationCriteria(
    record: AchievementRecord,
    targetSnapshot: TargetSnapshot
  ): { needsManualReview: boolean; reason?: string } {
    const allSourcesVerified = record.achievementSources.every(
      source => source.verificationStatus === 'VERIFIED'
    );

    if (!allSourcesVerified) {
      return {
        needsManualReview: true,
        reason: '存在未验证的数据源，需要人工确认'
      };
    }

    const sourceTotal = record.achievementSources.reduce(
      (sum, source) => sum + source.sourceAmount,
      0
    );

    const discrepancy = Math.abs(sourceTotal - record.achievementAmount);
    const discrepancyRate = discrepancy / record.achievementAmount;

    if (discrepancyRate > 0.05) {
      return {
        needsManualReview: true,
        reason: `数据源总和(${sourceTotal})与申报金额(${record.achievementAmount})差异超过5%，需要人工复核`
      };
    }

    if (record.achievementRate > 2.0) {
      return {
        needsManualReview: true,
        reason: `达成率超过200%(${Math.round(record.achievementRate * 100)}%)，异常高达成需要人工确认`
      };
    }

    if (record.achievedTier === IncentiveTier.TIER_4) {
      return {
        needsManualReview: true,
        reason: '达到最高阶梯(TIER_4)奖励，需要人工复核确认'
      };
    }

    const existingProtection = dataStore.protectionPeriods.findAll().find(
      p => p.channelId === record.channelId &&
           p.year === record.year &&
           p.quarter === record.quarter &&
           p.isActive &&
           p.isApproved
    );

    if (existingProtection) {
      return {
        needsManualReview: true,
        reason: '该渠道处于保护期内，需要人工复核保护期规则应用'
      };
    }

    const existingCrossRegion = dataStore.crossRegionAssignments.findAll().find(
      a => a.achievementRecordId === record.id ||
           (a.originalChannelId === record.channelId &&
            a.year === record.year &&
            a.quarter === record.quarter)
    );

    if (existingCrossRegion) {
      return {
        needsManualReview: true,
        reason: '存在跨区归属记录，需要人工确认归属关系'
      };
    }

    return { needsManualReview: false };
  }

  private calculateTier(
    achievementAmount: number,
    targetSnapshot: TargetSnapshot
  ): {
    isAchieved: boolean;
    achievedTier: IncentiveTier | null;
    tierCalculationDetails: TierCalculationDetails;
  } {
    const sortedTiers = [...targetSnapshot.tierConfig].sort(
      (a, b) => b.minThreshold - a.minThreshold
    );

    let achievedTier: IncentiveTier | null = null;
    let applicableTierConfig: TierConfig | null = null;

    for (const tier of sortedTiers) {
      if (achievementAmount >= tier.minThreshold) {
        achievedTier = tier.tier;
        applicableTierConfig = tier;
        break;
      }
    }

    const isAchieved = achievedTier !== null;

    const calculationBreakdown: CalculationBreakdownItem[] = [
      {
        itemName: '目标金额',
        itemValue: targetSnapshot.targetAmount,
        itemDescription: `季度目标：${targetSnapshot.targetAmount}`
      },
      {
        itemName: '实际达成',
        itemValue: achievementAmount,
        itemDescription: '申报的实际达成金额'
      },
      {
        itemName: '达成率',
        itemValue: achievementAmount / targetSnapshot.targetAmount,
        itemDescription: `达成率：${Math.round((achievementAmount / targetSnapshot.targetAmount) * 100)}%`
      }
    ];

    if (achievedTier && applicableTierConfig) {
      calculationBreakdown.push({
        itemName: '适用阶梯',
        itemValue: applicableTierConfig.minThreshold,
        itemDescription: `${achievedTier}：${applicableTierConfig.description}`
      });
    }

    const tierCalculationDetails: TierCalculationDetails = {
      baseAmount: targetSnapshot.targetAmount,
      applicableTier: achievedTier || IncentiveTier.TIER_1,
      tierThreshold: applicableTierConfig?.minThreshold || 0,
      achievementAgainstThreshold: achievedTier ? achievementAmount : 0,
      calculationFormula: achievedTier 
        ? `达成金额(${achievementAmount}) >= 阶梯阈值(${applicableTierConfig!.minThreshold}) ? ${achievedTier} : 未达标`
        : `达成金额(${achievementAmount}) < 最低阶梯阈值，未达标`,
      calculationBreakdown,
      finalAmount: achievedTier && applicableTierConfig ? applicableTierConfig.incentiveAmount : 0
    };

    return {
      isAchieved,
      achievedTier,
      tierCalculationDetails
    };
  }

  public getRecordById(recordId: string): AchievementRecord | undefined {
    return dataStore.achievementRecords.findById(recordId);
  }

  public getRecordsByChannel(channelId: string): AchievementRecord[] {
    return dataStore.achievementRecords.findByCriteria({ channelId });
  }

  public getRecordHistory(recordId: string): StatusChangeLog[] {
    const record = dataStore.achievementRecords.findById(recordId);
    return record?.statusHistory || [];
  }
}

export const achievementService = new AchievementService();
