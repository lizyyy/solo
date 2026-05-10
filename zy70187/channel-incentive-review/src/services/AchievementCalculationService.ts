import { dataStore } from '../repositories/DataStore';
import { AchievementRecord, VerificationStatus, VerificationMethod, TierCalculationDetails, CalculationBreakdownItem, AchievementSource } from '../models/AchievementRecord';
import { TargetSnapshot, TierConfig } from '../models/TargetSnapshot';
import { ChannelIncentiveStatus, Quarter, IncentiveTier, OperatorInfo, StatusChangeLog } from '../models/types';
import { stateMachineEngine } from '../state-machine/StateMachineEngine';
import { StateTransitionRequest } from '../state-machine/types';

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

export interface VerifyAchievementRequest {
  achievementId: string;
  verificationMethod: VerificationMethod;
  verifiedBy: string;
  manualReviewRequired?: boolean;
  manualReviewReason?: string;
}

export class AchievementCalculationService {
  createRecord(request: CreateAchievementRecordRequest): AchievementRecord {
    const snapshot = dataStore.targetSnapshots.findById(request.targetSnapshotId);
    
    if (!snapshot) {
      throw new Error(`目标快照 ${request.targetSnapshotId} 不存在`);
    }

    if (!snapshot.isFinalized) {
      throw new Error('目标快照尚未确定，不能创建达标记录');
    }

    const existing = this.findRecord(request.channelId, request.year, request.quarter);
    if (existing) {
      throw new Error(`渠道 ${request.channelId} 在 ${request.year}年${request.quarter} 的达标记录已存在`);
    }

    const achievementRate = (request.achievementAmount / snapshot.targetAmount) * 100;
    const { isAchieved, achievedTier, tierDetails } = this.calculateAchievement(request.achievementAmount, snapshot.tierConfig);

    const achievementRecord: Omit<AchievementRecord, keyof AchievementRecord> = {
      channelId: request.channelId,
      channelName: request.channelName,
      year: request.year,
      quarter: request.quarter,
      targetSnapshotId: request.targetSnapshotId,
      targetSnapshot: snapshot,
      achievementAmount: request.achievementAmount,
      achievementRate,
      isAchieved,
      achievedTier,
      tierCalculationDetails: tierDetails,
      verificationStatus: VerificationStatus.PENDING,
      verificationMethod: null,
      verifiedAt: null,
      verifiedBy: null,
      achievementSources: request.achievementSources,
      exclusionReasons: [],
      currentStatus: ChannelIncentiveStatus.INITIAL,
      statusHistory: [],
      notes: request.notes || ''
    };

    return dataStore.achievementRecords.create(achievementRecord);
  }

  findRecord(channelId: string, year: number, quarter: Quarter): AchievementRecord | undefined {
    return dataStore.achievementRecords.findAll().find(
      r => r.channelId === channelId && r.year === year && r.quarter === quarter
    );
  }

  getById(id: string): AchievementRecord | undefined {
    return dataStore.achievementRecords.findById(id);
  }

  submitForVerification(achievementId: string, operator: OperatorInfo): AchievementRecord {
    const record = dataStore.achievementRecords.findById(achievementId);
    
    if (!record) {
      throw new Error(`达标记录 ${achievementId} 不存在`);
    }

    const transitionRequest: StateTransitionRequest = {
      fromStatus: record.currentStatus,
      toStatus: ChannelIncentiveStatus.PENDING_VERIFICATION,
      operator,
      reason: '提交达标数据进行审核',
      context: { achievementId }
    };

    const transitionResult = stateMachineEngine.transition(transitionRequest);
    
    if (!transitionResult.success || !transitionResult.statusChange) {
      throw new Error(transitionResult.errorMessage || '状态流转失败');
    }

    const newHistory = [...record.statusHistory, transitionResult.statusChange];

    return dataStore.achievementRecords.update(achievementId, {
      currentStatus: ChannelIncentiveStatus.PENDING_VERIFICATION,
      statusHistory: newHistory
    })!;
  }

  verify(request: VerifyAchievementRequest, operator: OperatorInfo): AchievementRecord {
    const record = dataStore.achievementRecords.findById(request.achievementId);
    
    if (!record) {
      throw new Error(`达标记录 ${request.achievementId} 不存在`);
    }

    if (record.currentStatus !== ChannelIncentiveStatus.PENDING_VERIFICATION) {
      throw new Error(`当前状态为「${this.getStatusDescription(record.currentStatus)}」，不能进行审核操作`);
    }

    if (request.manualReviewRequired) {
      return this.flagForManualReview(record, request.manualReviewReason || '需要人工复核', operator);
    }

    const verificationResult = this.performAutoVerification(record);
    
    const targetStatus = verificationResult.passed 
      ? ChannelIncentiveStatus.VERIFIED 
      : ChannelIncentiveStatus.MANUAL_REVIEW;

    const transitionRequest: StateTransitionRequest = {
      fromStatus: record.currentStatus,
      toStatus: targetStatus,
      operator: {
        operatorId: request.verifiedBy,
        operatorName: operator.operatorName,
        operatorRole: operator.operatorRole,
        timestamp: new Date()
      },
      reason: verificationResult.passed ? '自动审核通过' : verificationResult.reason || '需要人工复核',
      context: { achievementId: request.achievementId }
    };

    const transitionResult = stateMachineEngine.transition(transitionRequest);
    
    if (!transitionResult.success || !transitionResult.statusChange) {
      throw new Error(transitionResult.errorMessage || '状态流转失败');
    }

    const newHistory = [...record.statusHistory, transitionResult.statusChange];

    return dataStore.achievementRecords.update(request.achievementId, {
      verificationStatus: verificationResult.passed ? VerificationStatus.AUTO_VERIFIED : VerificationStatus.PENDING,
      verificationMethod: request.verificationMethod,
      verifiedAt: new Date(),
      verifiedBy: request.verifiedBy,
      currentStatus: targetStatus,
      statusHistory: newHistory
    })!;
  }

  private performAutoVerification(record: AchievementRecord): { passed: boolean; reason?: string } {
    const sourceCount = record.achievementSources.length;
    
    if (sourceCount === 0) {
      return { passed: false, reason: '没有达标来源数据' };
    }

    const totalSourceAmount = record.achievementSources.reduce((sum, s) => sum + s.sourceAmount, 0);
    const difference = Math.abs(totalSourceAmount - record.achievementAmount);
    const tolerance = record.achievementAmount * 0.01;

    if (difference > tolerance) {
      return { 
        passed: false, 
        reason: `达标金额(${record.achievementAmount})与来源汇总(${totalSourceAmount})差异超过1%` 
      };
    }

    const disputedSources = record.achievementSources.filter(
      s => s.verificationStatus === 'DISPUTED'
    );

    if (disputedSources.length > 0) {
      return { passed: false, reason: `${disputedSources.length}个来源数据存在争议` };
    }

    if (record.achievementRate < 100 && record.isAchieved) {
      return { passed: false, reason: '达标率低于100%但标记为已达标，需要人工确认' };
    }

    return { passed: true };
  }

  private flagForManualReview(
    record: AchievementRecord, 
    reason: string, 
    operator: OperatorInfo
  ): AchievementRecord {
    const transitionRequest: StateTransitionRequest = {
      fromStatus: record.currentStatus,
      toStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
      operator,
      reason,
      context: { achievementId: record.id }
    };

    const transitionResult = stateMachineEngine.transition(transitionRequest);
    
    if (!transitionResult.success || !transitionResult.statusChange) {
      throw new Error(transitionResult.errorMessage || '状态流转失败');
    }

    const newHistory = [...record.statusHistory, transitionResult.statusChange];

    return dataStore.achievementRecords.update(record.id, {
      currentStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
      statusHistory: newHistory,
      notes: record.notes ? `${record.notes}; ${reason}` : reason
    })!;
  }

  private calculateAchievement(
    achievementAmount: number, 
    tierConfig: TierConfig[]
  ): { isAchieved: boolean; achievedTier: IncentiveTier | null; tierDetails: TierCalculationDetails } {
    const sortedTiers = [...tierConfig].sort((a, b) => a.minThreshold - b.minThreshold);
    
    let achievedTier: IncentiveTier | null = null;
    let applicableTier: TierConfig | null = null;

    for (const tier of sortedTiers) {
      if (achievementAmount >= tier.minThreshold && achievementAmount < tier.maxThreshold) {
        achievedTier = tier.tier;
        applicableTier = tier;
        break;
      }
    }

    if (!applicableTier) {
      const maxTier = sortedTiers[sortedTiers.length - 1];
      if (achievementAmount >= maxTier.maxThreshold) {
        achievedTier = maxTier.tier;
        applicableTier = maxTier;
      }
    }

    const isAchieved = achievedTier !== null;

    const calculationBreakdown: CalculationBreakdownItem[] = [
      {
        itemName: '实际完成金额',
        itemValue: achievementAmount,
        itemDescription: '渠道实际完成的业绩金额'
      }
    ];

    if (applicableTier) {
      calculationBreakdown.push(
        {
          itemName: '适用阶梯',
          itemValue: 1,
          itemDescription: `阶梯 ${applicableTier.tier}: ${applicableTier.minThreshold}-${applicableTier.maxThreshold}`
        },
        {
          itemName: '阶梯激励率',
          itemValue: applicableTier.incentiveRate,
          itemDescription: applicableTier.description
        }
      );
    }

    const tierDetails: TierCalculationDetails = {
      baseAmount: achievementAmount,
      applicableTier: achievedTier || IncentiveTier.TIER_1,
      tierThreshold: applicableTier?.minThreshold || 0,
      achievementAgainstThreshold: applicableTier 
        ? achievementAmount / applicableTier.minThreshold 
        : 0,
      calculationFormula: applicableTier 
        ? `实际金额 = ${achievementAmount}, 阶梯阈值 = ${applicableTier.minThreshold}-${applicableTier.maxThreshold}`
        : `实际金额 = ${achievementAmount}, 未达到最低阶梯`,
      calculationBreakdown,
      finalAmount: applicableTier?.incentiveAmount || 0
    };

    return { isAchieved, achievedTier, tierDetails };
  }

  private getStatusDescription(status: ChannelIncentiveStatus): string {
    const descriptions: Partial<Record<ChannelIncentiveStatus, string>> = {
      [ChannelIncentiveStatus.INITIAL]: '初始状态',
      [ChannelIncentiveStatus.PENDING_VERIFICATION]: '待审核',
      [ChannelIncentiveStatus.VERIFIED]: '已验证',
      [ChannelIncentiveStatus.DISPUTED]: '有争议',
      [ChannelIncentiveStatus.MANUAL_REVIEW]: '人工复核中',
      [ChannelIncentiveStatus.APPROVED]: '已审批',
      [ChannelIncentiveStatus.REJECTED]: '已拒绝',
      [ChannelIncentiveStatus.PAYOUT_SCHEDULED]: '付款待安排',
      [ChannelIncentiveStatus.PAID]: '已付款',
      [ChannelIncentiveStatus.CANCELLED]: '已取消'
    };
    return descriptions[status] || status;
  }
}

export const achievementCalculationService = new AchievementCalculationService();
