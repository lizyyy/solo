import { dataStore } from '../repositories/DataStore';
import { auditLogger, LogModule } from '../utils/AuditLogger';
import { OperatorInfo, ChannelIncentiveStatus, StatusChangeLog, IncentiveTier, Quarter } from '../models/types';
import { 
  IncentiveDetail, 
  PaymentStatus, 
  IncentiveCalculationDetails,
  BaseCalculation,
  TierCalculation,
  ProtectionAdjustment,
  CrossRegionAdjustment,
  FinalCalculation,
  DeductionItem
} from '../models/IncentiveDetail';
import { stateMachineEngine } from '../state-machine/StateMachineEngine';
import { achievementService } from './AchievementService';
import { protectionPeriodService } from './ProtectionPeriodService';
import { crossRegionAssignmentService } from './CrossRegionAssignmentService';

export interface CalculateIncentiveRequest {
  achievementRecordId: string;
  notes?: string;
}

export interface IncentiveResult {
  success: boolean;
  incentiveDetail?: IncentiveDetail;
  errorMessage?: string;
  warningMessages?: string[];
  needsManualReview?: boolean;
  manualReviewReason?: string;
}

export class IncentiveCalculationService {
  public calculateIncentive(
    request: CalculateIncentiveRequest, 
    operator: OperatorInfo
  ): IncentiveResult {
    const warnings: string[] = [];

    const achievementRecord = achievementService.getRecordById(request.achievementRecordId);
    if (!achievementRecord) {
      return {
        success: false,
        errorMessage: `达标记录不存在：${request.achievementRecordId}`
      };
    }

    const allowedStatuses = [
      ChannelIncentiveStatus.VERIFIED,
      ChannelIncentiveStatus.APPROVED
    ];

    if (!allowedStatuses.includes(achievementRecord.currentStatus)) {
      return {
        success: false,
        errorMessage: `当前状态「${achievementRecord.currentStatus}」不允许计算激励。请确保达标记录处于「已验证」或「已审批」状态。`
      };
    }

    if (!achievementRecord.isAchieved) {
      return {
        success: false,
        errorMessage: '该渠道未达成目标，无法计算激励'
      };
    }

    const existingIncentive = dataStore.incentiveDetails.findAll().find(
      i => i.achievementRecordId === request.achievementRecordId
    );

    if (existingIncentive) {
      if (existingIncentive.currentStatus !== ChannelIncentiveStatus.INITIAL &&
          existingIncentive.currentStatus !== ChannelIncentiveStatus.REJECTED) {
        return {
          success: false,
          errorMessage: `该达标记录(${request.achievementRecordId})已存在激励明细，状态：${existingIncentive.currentStatus}。如需重新计算，请先将状态改为「已拒绝」或「初始状态」。`
        };
      }
      warnings.push('已存在激励明细，将重新计算并覆盖');
    }

    const calculationDetails = this.performCalculation(
      achievementRecord,
      warnings
    );

    const incentiveDetail = dataStore.incentiveDetails.create({
      channelId: achievementRecord.channelId,
      channelName: achievementRecord.channelName,
      year: achievementRecord.year,
      quarter: achievementRecord.quarter,
      achievementRecordId: request.achievementRecordId,
      achievementRecord,
      protectionPeriodId: calculationDetails.protectionPeriodId,
      crossRegionAssignmentId: calculationDetails.crossRegionAssignmentId,
      baseIncentiveAmount: calculationDetails.baseIncentiveAmount,
      tierIncentiveAmount: calculationDetails.tierIncentiveAmount,
      protectionAdjustmentAmount: calculationDetails.protectionAdjustmentAmount,
      crossRegionSplitAmount: calculationDetails.crossRegionSplitAmount,
      deductionAmount: calculationDetails.deductionAmount,
      finalIncentiveAmount: calculationDetails.finalIncentiveAmount,
      tier: calculationDetails.tier,
      incentiveRate: calculationDetails.incentiveRate,
      calculationDetails: calculationDetails.calculationDetails,
      paymentStatus: PaymentStatus.NOT_SCHEDULED,
      scheduledPaymentDate: null,
      actualPaymentDate: null,
      paymentReference: null,
      currentStatus: ChannelIncentiveStatus.INITIAL,
      statusHistory: [],
      isManualAdjustment: false,
      manualAdjustmentReason: null,
      adjustedBy: null,
      notes: request.notes || ''
    });

    auditLogger.log({
      module: LogModule.INCENTIVE_CALCULATION,
      operation: 'CALCULATE_INCENTIVE',
      operator,
      targetEntityType: 'IncentiveDetail',
      targetEntityId: incentiveDetail.id,
      afterState: { 
        finalAmount: calculationDetails.finalIncentiveAmount,
        tier: calculationDetails.tier
      },
      success: true,
      reason: `计算激励金额：${calculationDetails.finalIncentiveAmount}`
    });

    return {
      success: true,
      incentiveDetail,
      warningMessages: warnings
    };
  }

  private performCalculation(
    achievementRecord: any,
    warnings: string[]
  ): {
    baseIncentiveAmount: number;
    tierIncentiveAmount: number;
    protectionAdjustmentAmount: number;
    crossRegionSplitAmount: number;
    deductionAmount: number;
    finalIncentiveAmount: number;
    tier: IncentiveTier;
    incentiveRate: number;
    calculationDetails: IncentiveCalculationDetails;
    protectionPeriodId: string | null;
    crossRegionAssignmentId: string | null;
  } {
    const targetSnapshot = achievementRecord.targetSnapshot;
    const tierConfig = achievementRecord.tierCalculationDetails;

    const baseRate = 0.05;
    const baseIncentiveAmount = achievementRecord.achievementAmount * baseRate;

    let finalTier = achievementRecord.achievedTier || IncentiveTier.TIER_1;
    let tierIncentiveAmount = tierConfig.finalAmount;
    let protectionAdjustmentAmount = 0;
    let protectionAdjustment: ProtectionAdjustment | null = null;

    const activeProtection = protectionPeriodService.getActiveProtection(
      achievementRecord.channelId,
      achievementRecord.year,
      achievementRecord.quarter
    );

    if (activeProtection && activeProtection.isApproved) {
      const protectionResult = this.applyProtection(
        achievementRecord,
        activeProtection,
        finalTier,
        tierIncentiveAmount
      );

      if (protectionResult.tierAdjusted) {
        finalTier = protectionResult.newTier;
        warnings.push(`应用保护期规则：阶梯从${achievementRecord.achievedTier}调整为${finalTier}`);
      }

      if (protectionResult.amountAdjusted) {
        protectionAdjustmentAmount = protectionResult.adjustmentAmount;
        protectionAdjustment = protectionResult.adjustment;
        warnings.push(`应用保护期调整：${protectionAdjustmentAmount > 0 ? '+' : ''}${protectionAdjustmentAmount}`);
      }
    }

    let crossRegionSplitAmount = 0;
    let crossRegionAdjustment: CrossRegionAdjustment | null = null;

    const approvedAssignment = crossRegionAssignmentService.getApprovedAssignment(
      achievementRecord.id
    );

    if (approvedAssignment) {
      crossRegionSplitAmount = tierIncentiveAmount * (approvedAssignment.splitPercentage / 100);
      tierIncentiveAmount = tierIncentiveAmount - crossRegionSplitAmount;
      
      crossRegionAdjustment = {
        assignmentType: approvedAssignment.assignmentType,
        splitPercentage: approvedAssignment.splitPercentage,
        adjustmentAmount: -crossRegionSplitAmount,
        reason: `跨区归属：${approvedAssignment.originalChannelName} -> ${approvedAssignment.assignedChannelName}`
      };
      
      warnings.push(`跨区归属调整：扣除${crossRegionSplitAmount}（${approvedAssignment.splitPercentage}%）`);
    }

    const deductions: DeductionItem[] = [];
    let deductionAmount = 0;

    const baseCalculation: BaseCalculation = {
      achievementAmount: achievementRecord.achievementAmount,
      baseRate,
      baseAmount: baseIncentiveAmount,
      formula: `基础金额 = 达成金额(${achievementRecord.achievementAmount}) × 基础比率(${baseRate})`
    };

    const tierCalculation: TierCalculation = {
      achievedTier: finalTier,
      tierRate: 1.0,
      tierMultiplier: 1.0,
      tierAmount: tierIncentiveAmount,
      formula: `阶梯金额 = 根据阶梯配置计算`,
      protectionApplied: activeProtection !== undefined,
      protectionTier: activeProtection?.protectionTerms.protectedTier as IncentiveTier || null
    };

    const grossAmount = tierIncentiveAmount + protectionAdjustmentAmount;
    const totalAdjustments = protectionAdjustmentAmount - crossRegionSplitAmount - deductionAmount;
    const netAmount = grossAmount - crossRegionSplitAmount - deductionAmount;

    const finalCalculation: FinalCalculation = {
      grossAmount,
      totalAdjustments,
      netAmount,
      formula: `最终金额 = 阶梯金额(${tierIncentiveAmount}) + 保护期调整(${protectionAdjustmentAmount}) - 跨区扣除(${crossRegionSplitAmount}) - 其他扣除(${deductionAmount})`
    };

    const calculationDetails: IncentiveCalculationDetails = {
      baseCalculation,
      tierCalculation,
      protectionAdjustment,
      crossRegionAdjustment,
      deductions,
      finalCalculation
    };

    return {
      baseIncentiveAmount,
      tierIncentiveAmount,
      protectionAdjustmentAmount,
      crossRegionSplitAmount,
      deductionAmount,
      finalIncentiveAmount: netAmount,
      tier: finalTier,
      incentiveRate: baseRate,
      calculationDetails,
      protectionPeriodId: activeProtection?.id || null,
      crossRegionAssignmentId: approvedAssignment?.id || null
    };
  }

  private applyProtection(
    achievementRecord: any,
    protection: any,
    currentTier: IncentiveTier,
    currentAmount: number
  ): {
    tierAdjusted: boolean;
    newTier: IncentiveTier;
    amountAdjusted: boolean;
    adjustmentAmount: number;
    adjustment: ProtectionAdjustment | null;
  } {
    let tierAdjusted = false;
    let newTier = currentTier;
    let amountAdjusted = false;
    let adjustmentAmount = 0;
    let adjustment: ProtectionAdjustment | null = null;

    const tierOrder = [
      IncentiveTier.TIER_1,
      IncentiveTier.TIER_2,
      IncentiveTier.TIER_3,
      IncentiveTier.TIER_4
    ];

    switch (protection.protectionType) {
      case 'TIER_PROTECTION':
        const protectedTier = protection.protectionTerms.protectedTier;
        if (protectedTier) {
          const currentTierIndex = tierOrder.indexOf(currentTier);
          const protectedTierIndex = tierOrder.indexOf(protectedTier as IncentiveTier);
          
          if (currentTierIndex < protectedTierIndex) {
            newTier = protectedTier as IncentiveTier;
            tierAdjusted = true;
          }
        }
        break;

      case 'THRESHOLD_PROTECTION':
        const protectedThreshold = protection.protectionTerms.protectedThreshold;
        if (protectedThreshold !== null && protectedThreshold !== undefined) {
          if (achievementRecord.achievementAmount < protectedThreshold) {
            adjustmentAmount = 1000;
            amountAdjusted = true;
            adjustment = {
              protectionType: protection.protectionType,
              adjustmentType: 'ADDITION',
              adjustmentAmount,
              reason: `阈值保护：实际达成(${achievementRecord.achievementAmount}) < 保护阈值(${protectedThreshold})`
            };
          }
        }
        break;

      case 'RATE_PROTECTION':
        const protectedRate = protection.protectionTerms.protectedRate;
        if (protectedRate !== null && protectedRate !== undefined) {
          adjustmentAmount = currentAmount * (protectedRate - 0.05);
          amountAdjusted = true;
          adjustment = {
            protectionType: protection.protectionType,
            adjustmentType: 'ADDITION',
            adjustmentAmount,
            reason: `比率保护：应用保护比率${protectedRate}`
          };
        }
        break;

      case 'FULL_INCENTIVE_PROTECTION':
        const protectedAmount = protection.protectionTerms.protectedAmount;
        if (protectedAmount !== null && protectedAmount !== undefined) {
          if (currentAmount < protectedAmount) {
            adjustmentAmount = protectedAmount - currentAmount;
            amountAdjusted = true;
            adjustment = {
              protectionType: protection.protectionType,
              adjustmentType: 'ADDITION',
              adjustmentAmount,
              reason: `全额保护：保证最低金额${protectedAmount}`
            };
          }
        }
        break;
    }

    return {
      tierAdjusted,
      newTier,
      amountAdjusted,
      adjustmentAmount,
      adjustment
    };
  }

  public approveIncentive(
    incentiveId: string, 
    operator: OperatorInfo
  ): IncentiveResult {
    const incentive = dataStore.incentiveDetails.findById(incentiveId);
    if (!incentive) {
      return {
        success: false,
        errorMessage: `激励明细不存在：${incentiveId}`
      };
    }

    const transitionResult = stateMachineEngine.transition({
      fromStatus: incentive.currentStatus,
      toStatus: ChannelIncentiveStatus.APPROVED,
      operator,
      reason: '审批通过激励'
    });

    if (!transitionResult.success) {
      return {
        success: false,
        errorMessage: transitionResult.errorMessage,
        warningMessages: transitionResult.allowedTransitions ? 
          [`允许的状态流转：${transitionResult.allowedTransitions.join(', ')}`] : undefined
      };
    }

    const updated = dataStore.incentiveDetails.update(incentiveId, {
      currentStatus: ChannelIncentiveStatus.APPROVED,
      statusHistory: [...incentive.statusHistory, transitionResult.statusChange!]
    });

    auditLogger.log({
      module: LogModule.INCENTIVE_CALCULATION,
      operation: 'APPROVE_INCENTIVE',
      operator,
      targetEntityType: 'IncentiveDetail',
      targetEntityId: incentiveId,
      beforeState: { status: incentive.currentStatus },
      afterState: { status: ChannelIncentiveStatus.APPROVED },
      success: true,
      reason: '审批通过激励'
    });

    return {
      success: true,
      incentiveDetail: updated
    };
  }

  public schedulePayout(
    incentiveId: string, 
    scheduledDate: Date,
    operator: OperatorInfo
  ): IncentiveResult {
    const incentive = dataStore.incentiveDetails.findById(incentiveId);
    if (!incentive) {
      return {
        success: false,
        errorMessage: `激励明细不存在：${incentiveId}`
      };
    }

    const transitionResult = stateMachineEngine.transition({
      fromStatus: incentive.currentStatus,
      toStatus: ChannelIncentiveStatus.PAYOUT_SCHEDULED,
      operator,
      reason: `安排付款，日期：${scheduledDate.toLocaleDateString('zh-CN')}`
    });

    if (!transitionResult.success) {
      return {
        success: false,
        errorMessage: transitionResult.errorMessage
      };
    }

    const updated = dataStore.incentiveDetails.update(incentiveId, {
      currentStatus: ChannelIncentiveStatus.PAYOUT_SCHEDULED,
      statusHistory: [...incentive.statusHistory, transitionResult.statusChange!],
      paymentStatus: PaymentStatus.SCHEDULED,
      scheduledPaymentDate: scheduledDate
    });

    auditLogger.log({
      module: LogModule.INCENTIVE_CALCULATION,
      operation: 'SCHEDULE_PAYOUT',
      operator,
      targetEntityType: 'IncentiveDetail',
      targetEntityId: incentiveId,
      beforeState: { 
        status: incentive.currentStatus,
        paymentStatus: incentive.paymentStatus
      },
      afterState: { 
        status: ChannelIncentiveStatus.PAYOUT_SCHEDULED,
        paymentStatus: PaymentStatus.SCHEDULED,
        scheduledPaymentDate: scheduledDate
      },
      success: true,
      reason: `安排付款日期：${scheduledDate.toLocaleDateString('zh-CN')}`
    });

    return {
      success: true,
      incentiveDetail: updated
    };
  }

  public markAsPaid(
    incentiveId: string, 
    paymentReference: string,
    operator: OperatorInfo
  ): IncentiveResult {
    const incentive = dataStore.incentiveDetails.findById(incentiveId);
    if (!incentive) {
      return {
        success: false,
        errorMessage: `激励明细不存在：${incentiveId}`
      };
    }

    const transitionResult = stateMachineEngine.transition({
      fromStatus: incentive.currentStatus,
      toStatus: ChannelIncentiveStatus.PAID,
      operator,
      reason: `付款完成，参考号：${paymentReference}`
    });

    if (!transitionResult.success) {
      return {
        success: false,
        errorMessage: transitionResult.errorMessage
      };
    }

    const updated = dataStore.incentiveDetails.update(incentiveId, {
      currentStatus: ChannelIncentiveStatus.PAID,
      statusHistory: [...incentive.statusHistory, transitionResult.statusChange!],
      paymentStatus: PaymentStatus.PAID,
      actualPaymentDate: new Date(),
      paymentReference
    });

    auditLogger.log({
      module: LogModule.INCENTIVE_CALCULATION,
      operation: 'MARK_AS_PAID',
      operator,
      targetEntityType: 'IncentiveDetail',
      targetEntityId: incentiveId,
      beforeState: { 
        status: incentive.currentStatus,
        paymentStatus: incentive.paymentStatus
      },
      afterState: { 
        status: ChannelIncentiveStatus.PAID,
        paymentStatus: PaymentStatus.PAID,
        paymentReference
      },
      success: true,
      reason: `标记为已付款，参考号：${paymentReference}`
    });

    return {
      success: true,
      incentiveDetail: updated
    };
  }

  public getIncentiveById(incentiveId: string): IncentiveDetail | undefined {
    return dataStore.incentiveDetails.findById(incentiveId);
  }

  public getIncentivesByChannel(channelId: string): IncentiveDetail[] {
    return dataStore.incentiveDetails.findByCriteria({ channelId });
  }

  public getIncentiveHistory(incentiveId: string): StatusChangeLog[] {
    const incentive = dataStore.incentiveDetails.findById(incentiveId);
    return incentive?.statusHistory || [];
  }
}

export const incentiveCalculationService = new IncentiveCalculationService();
