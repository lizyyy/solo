import { dataStore } from '../repositories/DataStore';
import { auditLogger, LogModule } from '../utils/AuditLogger';
import { OperatorInfo } from '../models/types';
import { 
  ProtectionPeriod, 
  ProtectionType, 
  ProtectionReason, 
  ProtectionTerms,
  ApplicationRule
} from '../models/ProtectionPeriod';
import { Quarter } from '../models/types';

export interface CreateProtectionPeriodRequest {
  channelId: string;
  channelName: string;
  year: number;
  quarter: Quarter;
  protectionType: ProtectionType;
  protectionReason: ProtectionReason;
  effectiveStartDate: Date;
  effectiveEndDate: Date;
  protectionTerms: ProtectionTerms;
  achievementRecordId?: string;
  relatedDisputeId?: string;
  notes?: string;
}

export interface ProtectionResult {
  success: boolean;
  protectionPeriod?: ProtectionPeriod;
  errorMessage?: string;
  warningMessages?: string[];
}

export class ProtectionPeriodService {
  public createProtectionPeriod(
    request: CreateProtectionPeriodRequest, 
    operator: OperatorInfo
  ): ProtectionResult {
    const warnings: string[] = [];

    const existingActiveProtection = dataStore.protectionPeriods.findAll().find(
      p => p.channelId === request.channelId &&
           p.year === request.year &&
           p.quarter === request.quarter &&
           p.isActive
    );

    if (existingActiveProtection) {
      return {
        success: false,
        errorMessage: `该渠道(${request.channelId})在${request.year}年${request.quarter}已存在活跃的保护期，不能重复创建。如需修改，请先终止现有保护期。`
      };
    }

    if (request.effectiveStartDate > request.effectiveEndDate) {
      return {
        success: false,
        errorMessage: '保护期开始日期不能晚于结束日期'
      };
    }

    const validationResult = this.validateProtectionTerms(
      request.protectionType, 
      request.protectionTerms
    );
    if (!validationResult.valid) {
      return {
        success: false,
        errorMessage: validationResult.errorMessage!
      };
    }

    if (request.protectionReason === ProtectionReason.PREVIOUS_QUARTER_ACHIEVEMENT) {
      const previousQuarter = this.getPreviousQuarter(request.year, request.quarter);
      const previousAchievement = dataStore.achievementRecords.findAll().find(
        r => r.channelId === request.channelId &&
             r.year === previousQuarter.year &&
             r.quarter === previousQuarter.quarter &&
             r.isAchieved
      );
      
      if (!previousAchievement) {
        warnings.push('基于上季度达标创建保护期，但未找到上季度达标记录');
      }
    }

    const protectionPeriod = dataStore.protectionPeriods.create({
      channelId: request.channelId,
      channelName: request.channelName,
      year: request.year,
      quarter: request.quarter,
      protectionType: request.protectionType,
      protectionReason: request.protectionReason,
      effectiveStartDate: request.effectiveStartDate,
      effectiveEndDate: request.effectiveEndDate,
      protectionTerms: request.protectionTerms,
      isActive: true,
      isApproved: false,
      approvedBy: null,
      approvedAt: null,
      achievementRecordId: request.achievementRecordId || null,
      relatedDisputeId: request.relatedDisputeId || null,
      notes: request.notes || ''
    });

    auditLogger.log({
      module: LogModule.PROTECTION_PERIOD,
      operation: 'CREATE_PROTECTION',
      operator,
      targetEntityType: 'ProtectionPeriod',
      targetEntityId: protectionPeriod.id,
      afterState: { ...protectionPeriod },
      success: true,
      reason: `创建渠道${request.channelId}的${request.year}年${request.quarter}保护期，类型：${request.protectionType}`
    });

    return {
      success: true,
      protectionPeriod,
      warningMessages: warnings
    };
  }

  public approveProtectionPeriod(
    protectionPeriodId: string, 
    operator: OperatorInfo
  ): ProtectionResult {
    const protectionPeriod = dataStore.protectionPeriods.findById(protectionPeriodId);
    if (!protectionPeriod) {
      return {
        success: false,
        errorMessage: `保护期记录不存在：${protectionPeriodId}`
      };
    }

    if (protectionPeriod.isApproved) {
      return {
        success: false,
        errorMessage: '该保护期已审批通过，不能重复审批'
      };
    }

    if (!protectionPeriod.isActive) {
      return {
        success: false,
        errorMessage: '该保护期已终止，不能审批'
      };
    }

    const updated = dataStore.protectionPeriods.update(protectionPeriodId, {
      isApproved: true,
      approvedBy: operator.operatorId,
      approvedAt: new Date()
    });

    auditLogger.log({
      module: LogModule.PROTECTION_PERIOD,
      operation: 'APPROVE_PROTECTION',
      operator,
      targetEntityType: 'ProtectionPeriod',
      targetEntityId: protectionPeriodId,
      beforeState: { isApproved: false },
      afterState: { isApproved: true },
      success: true,
      reason: '审批通过保护期'
    });

    return {
      success: true,
      protectionPeriod: updated
    };
  }

  public terminateProtectionPeriod(
    protectionPeriodId: string, 
    reason: string,
    operator: OperatorInfo
  ): ProtectionResult {
    const protectionPeriod = dataStore.protectionPeriods.findById(protectionPeriodId);
    if (!protectionPeriod) {
      return {
        success: false,
        errorMessage: `保护期记录不存在：${protectionPeriodId}`
      };
    }

    if (!protectionPeriod.isActive) {
      return {
        success: false,
        errorMessage: '该保护期已终止'
      };
    }

    const updated = dataStore.protectionPeriods.update(protectionPeriodId, {
      isActive: false,
      notes: protectionPeriod.notes + `\n[${new Date().toLocaleString('zh-CN')}] 终止原因：${reason}`
    });

    auditLogger.log({
      module: LogModule.PROTECTION_PERIOD,
      operation: 'TERMINATE_PROTECTION',
      operator,
      targetEntityType: 'ProtectionPeriod',
      targetEntityId: protectionPeriodId,
      beforeState: { isActive: true },
      afterState: { isActive: false },
      success: true,
      reason: `终止保护期：${reason}`
    });

    return {
      success: true,
      protectionPeriod: updated
    };
  }

  public getActiveProtection(
    channelId: string, 
    year: number, 
    quarter: Quarter
  ): ProtectionPeriod | undefined {
    return dataStore.protectionPeriods.findAll().find(
      p => p.channelId === channelId &&
           p.year === year &&
           p.quarter === quarter &&
           p.isActive &&
           p.isApproved
    );
  }

  public getProtectionById(protectionPeriodId: string): ProtectionPeriod | undefined {
    return dataStore.protectionPeriods.findById(protectionPeriodId);
  }

  private validateProtectionTerms(
    protectionType: ProtectionType, 
    terms: ProtectionTerms
  ): { valid: boolean; errorMessage?: string } {
    switch (protectionType) {
      case ProtectionType.TIER_PROTECTION:
        if (!terms.protectedTier) {
          return { valid: false, errorMessage: '阶梯保护需要指定保护的阶梯' };
        }
        break;
      case ProtectionType.THRESHOLD_PROTECTION:
        if (terms.protectedThreshold === null || terms.protectedThreshold === undefined) {
          return { valid: false, errorMessage: '阈值保护需要指定保护的阈值' };
        }
        break;
      case ProtectionType.RATE_PROTECTION:
        if (terms.protectedRate === null || terms.protectedRate === undefined) {
          return { valid: false, errorMessage: '比率保护需要指定保护的比率' };
        }
        break;
      case ProtectionType.FULL_INCENTIVE_PROTECTION:
        if (terms.protectedAmount === null || terms.protectedAmount === undefined) {
          return { valid: false, errorMessage: '全额保护需要指定保护的金额' };
        }
        break;
    }

    return { valid: true };
  }

  private getPreviousQuarter(year: number, quarter: Quarter): { year: number; quarter: Quarter } {
    const quarterOrder: Quarter[] = [Quarter.Q1, Quarter.Q2, Quarter.Q3, Quarter.Q4];
    const currentIndex = quarterOrder.indexOf(quarter);
    
    if (currentIndex === 0) {
      return { year: year - 1, quarter: Quarter.Q4 };
    }
    return { year, quarter: quarterOrder[currentIndex - 1] };
  }
}

export const protectionPeriodService = new ProtectionPeriodService();
