import { dataStore } from '../repositories/DataStore';
import { auditLogger, LogModule } from '../utils/AuditLogger';
import { OperatorInfo } from '../models/types';
import { TargetSnapshot, TierConfig, TargetType, TargetUnit } from '../models/TargetSnapshot';
import { Quarter, IncentiveTier } from '../models/types';

export interface CreateTargetSnapshotRequest {
  channelId: string;
  channelName: string;
  regionId: string;
  regionName: string;
  year: number;
  quarter: Quarter;
  targetType: TargetType;
  targetAmount: number;
  targetUnit: TargetUnit;
  tierConfig: TierConfig[];
  snapshotSource: string;
  snapshotNotes?: string;
}

export interface TargetSnapshotResult {
  success: boolean;
  snapshot?: TargetSnapshot;
  errorMessage?: string;
  warningMessages?: string[];
}

export class TargetSnapshotService {
  public createSnapshot(request: CreateTargetSnapshotRequest, operator: OperatorInfo): TargetSnapshotResult {
    const warnings: string[] = [];
    
    const existingSnapshot = dataStore.targetSnapshots.findAll().find(
      s => s.channelId === request.channelId && 
           s.year === request.year && 
           s.quarter === request.quarter
    );
    
    if (existingSnapshot) {
      if (existingSnapshot.isFinalized) {
        return {
          success: false,
          errorMessage: `该渠道(${request.channelId})在${request.year}年${request.quarter}的目标快照已锁定，无法重复创建。如需修改，请联系管理员解锁。`
        };
      }
      warnings.push(`该渠道在${request.year}年${request.quarter}已存在目标快照，将创建新版本`);
    }

    const validationResult = this.validateTierConfig(request.tierConfig);
    if (!validationResult.valid) {
      return {
        success: false,
        errorMessage: validationResult.errorMessage!
      };
    }

    const snapshot = dataStore.targetSnapshots.create({
      channelId: request.channelId,
      channelName: request.channelName,
      regionId: request.regionId,
      regionName: request.regionName,
      year: request.year,
      quarter: request.quarter,
      targetType: request.targetType,
      targetAmount: request.targetAmount,
      targetUnit: request.targetUnit,
      tierConfig: request.tierConfig,
      effectiveDate: new Date(),
      snapshotSource: request.snapshotSource,
      snapshotNotes: request.snapshotNotes || '',
      isFinalized: false
    });

    auditLogger.log({
      module: LogModule.TARGET_SNAPSHOT,
      operation: 'CREATE_SNAPSHOT',
      operator,
      targetEntityType: 'TargetSnapshot',
      targetEntityId: snapshot.id,
      afterState: { ...snapshot },
      success: true,
      reason: `创建渠道${request.channelId}的${request.year}年${request.quarter}目标快照`
    });

    return {
      success: true,
      snapshot,
      warningMessages: warnings
    };
  }

  public finalizeSnapshot(snapshotId: string, operator: OperatorInfo): TargetSnapshotResult {
    const snapshot = dataStore.targetSnapshots.findById(snapshotId);
    if (!snapshot) {
      return {
        success: false,
        errorMessage: `目标快照不存在：${snapshotId}`
      };
    }

    if (snapshot.isFinalized) {
      return {
        success: false,
        errorMessage: `目标快照已锁定，无法重复锁定`
      };
    }

    const updatedSnapshot = dataStore.targetSnapshots.update(snapshotId, {
      isFinalized: true
    });

    auditLogger.log({
      module: LogModule.TARGET_SNAPSHOT,
      operation: 'FINALIZE_SNAPSHOT',
      operator,
      targetEntityType: 'TargetSnapshot',
      targetEntityId: snapshotId,
      beforeState: { isFinalized: snapshot.isFinalized },
      afterState: { isFinalized: true },
      success: true,
      reason: `锁定目标快照，防止后续修改影响激励计算`
    });

    return {
      success: true,
      snapshot: updatedSnapshot
    };
  }

  public getSnapshot(channelId: string, year: number, quarter: Quarter): TargetSnapshot | undefined {
    return dataStore.targetSnapshots.findAll().find(
      s => s.channelId === channelId && 
           s.year === year && 
           s.quarter === quarter
    );
  }

  public getSnapshotById(snapshotId: string): TargetSnapshot | undefined {
    return dataStore.targetSnapshots.findById(snapshotId);
  }

  private validateTierConfig(tierConfig: TierConfig[]): { valid: boolean; errorMessage?: string } {
    if (tierConfig.length === 0) {
      return { valid: false, errorMessage: '阶梯配置不能为空' };
    }

    const tierOrder: IncentiveTier[] = [
      IncentiveTier.TIER_1,
      IncentiveTier.TIER_2,
      IncentiveTier.TIER_3,
      IncentiveTier.TIER_4
    ];

    const sortedConfig = [...tierConfig].sort((a, b) => 
      tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
    );

    for (let i = 0; i < sortedConfig.length; i++) {
      const current = sortedConfig[i];
      
      if (current.minThreshold < 0) {
        return { valid: false, errorMessage: `阶梯${current.tier}的最小阈值不能为负数` };
      }
      
      if (current.maxThreshold !== null && current.maxThreshold < current.minThreshold) {
        return { valid: false, errorMessage: `阶梯${current.tier}的最大阈值不能小于最小阈值` };
      }

      if (i < sortedConfig.length - 1) {
        const next = sortedConfig[i + 1];
        if (current.maxThreshold !== null && next.minThreshold < current.maxThreshold) {
          return { 
            valid: false, 
            errorMessage: `阶梯${current.tier}和${next.tier}的阈值存在重叠，请检查配置` 
          };
        }
      }
    }

    return { valid: true };
  }
}

export const targetSnapshotService = new TargetSnapshotService();
