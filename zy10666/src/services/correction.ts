import {
  CorrectionRecord,
  CorrectionStatus,
  CorrectionReason,
  CorrectionReasonLabel,
  SourceSystem,
  VideoInfo,
  UserInfo,
  TrialRule,
  ConflictInfo
} from '../types';
import { memoryStorage } from '../storage/memory';

export interface CreateCorrectionParams {
  video: VideoInfo;
  user: UserInfo;
  trialRule: TrialRule;
  sourceSystem: SourceSystem;
  sourceRecordId?: string;
  initialStatus?: CorrectionStatus;
  customReason?: string;
  operatorId?: string;
  operatorName?: string;
}

export interface UpdateStatusParams {
  recordId: string;
  newStatus: CorrectionStatus;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface CorrectionResult {
  success: boolean;
  record?: CorrectionRecord;
  businessCode: string;
  businessMessage: string;
  hasConflict?: boolean;
  conflictRecords?: string[];
}

const STATUS_TRANSITIONS: Record<CorrectionStatus, CorrectionStatus[]> = {
  [CorrectionStatus.CAN_TRY]: [CorrectionStatus.CORRECTED, CorrectionStatus.REVOKED],
  [CorrectionStatus.ABNORMAL_PENDING]: [CorrectionStatus.CAN_TRY, CorrectionStatus.CORRECTED, CorrectionStatus.REVOKED],
  [CorrectionStatus.CORRECTED]: [CorrectionStatus.REVOKED],
  [CorrectionStatus.REVOKED]: []
};

class CorrectionService {
  async createCorrection(params: CreateCorrectionParams): Promise<CorrectionResult> {
    const conflicts = await memoryStorage.findConflicts(
      params.user.userId,
      params.video.videoId
    );

    let status: CorrectionStatus = params.initialStatus || CorrectionStatus.CAN_TRY;
    let correctionReason: CorrectionReason = CorrectionReason.NEW_RULE_APPLIED;
    let readableReason: string = CorrectionReasonLabel[CorrectionReason.NEW_RULE_APPLIED];
    let conflictInfo: ConflictInfo | undefined;

    if (conflicts.length > 0) {
      const conflictSystems = conflicts.map(c => c.sourceSystem);
      const allSystems = [...new Set([...conflictSystems, params.sourceSystem])];

      conflictInfo = {
        hasConflict: true,
        conflictRecords: conflicts.map(c => c.id),
        conflictSystems: allSystems,
        resolutionStrategy: this.getResolutionStrategy(allSystems, params.sourceSystem)
      };

      status = CorrectionStatus.ABNORMAL_PENDING;
      correctionReason = CorrectionReason.DUPLICATE_CONFLICT;
      readableReason = `检测到多系统数据冲突: ${allSystems.map(s => s).join(', ')}。${conflictInfo.resolutionStrategy}`;
    }

    if (params.user.isPaid && params.trialRule.ruleVersion.startsWith('v1')) {
      status = CorrectionStatus.ABNORMAL_PENDING;
      correctionReason = CorrectionReason.PAID_USER_BLOCKED_BY_OLD_RULE;
      readableReason = `付费用户(${params.user.userName})被旧试看规则(${params.trialRule.ruleName})限制播放，需人工复核处理`;
    }

    if (params.customReason) {
      readableReason = params.customReason;
    }

    const record = await memoryStorage.createRecord({
      video: params.video,
      user: params.user,
      trialRule: params.trialRule,
      status,
      correctionReason,
      readableReason,
      sourceSystem: params.sourceSystem,
      sourceRecordId: params.sourceRecordId,
      conflictInfo,
      operatorId: params.operatorId,
      operatorName: params.operatorName
    });

    if (conflicts.length > 0) {
      for (const conflict of conflicts) {
        if (!conflict.conflictInfo?.hasConflict) {
          await memoryStorage.updateRecord(conflict.id, {
            status: CorrectionStatus.ABNORMAL_PENDING,
            correctionReason: CorrectionReason.DUPLICATE_CONFLICT,
            readableReason: `检测到新数据冲突(来自${params.sourceSystem})，已标记为异常待判`,
            conflictInfo: {
              hasConflict: true,
              conflictRecords: [...(conflict.conflictInfo?.conflictRecords || []), record.id],
              conflictSystems: [...new Set([...(conflict.conflictInfo?.conflictSystems || []), params.sourceSystem])],
              resolutionStrategy: conflictInfo!.resolutionStrategy
            }
          });
        }
      }
    }

    return {
      success: true,
      record,
      businessCode: status,
      businessMessage: readableReason,
      hasConflict: conflicts.length > 0,
      conflictRecords: conflicts.map(c => c.id)
    };
  }

  async updateStatus(params: UpdateStatusParams): Promise<CorrectionResult> {
    const record = await memoryStorage.getRecordById(params.recordId);
    if (!record) {
      return {
        success: false,
        businessCode: 'RECORD_NOT_FOUND',
        businessMessage: '纠偏记录不存在'
      };
    }

    const allowedTransitions = STATUS_TRANSITIONS[record.status];
    if (!allowedTransitions.includes(params.newStatus)) {
      return {
        success: false,
        businessCode: 'INVALID_TRANSITION',
        businessMessage: `状态流转无效: 从${record.status}无法流转到${params.newStatus}`
      };
    }

    let newReadableReason = record.readableReason;
    if (params.remark) {
      newReadableReason = `${record.readableReason}。操作备注: ${params.remark}`;
    }

    const updatedRecord = await memoryStorage.updateRecord(params.recordId, {
      status: params.newStatus,
      readableReason: newReadableReason,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      remark: params.remark
    });

    await memoryStorage.addHistory({
      recordId: params.recordId,
      oldStatus: record.status,
      newStatus: params.newStatus,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      operationRemark: params.remark
    });

    return {
      success: true,
      record: updatedRecord!,
      businessCode: params.newStatus,
      businessMessage: `状态已更新为${params.newStatus}`
    };
  }

  async getRecordDetail(id: string): Promise<CorrectionRecord | null> {
    return memoryStorage.getRecordById(id);
  }

  private getResolutionStrategy(systems: SourceSystem[], newSystem: SourceSystem): string {
    const priority: SourceSystem[] = [
      SourceSystem.ORDER_SYSTEM,
      SourceSystem.USER_CENTER,
      SourceSystem.VOD_BACKEND,
      SourceSystem.CONTENT_MANAGEMENT,
      SourceSystem.IMPORT_BATCH
    ];

    const highestPriority = systems.reduce((a, b) =>
      priority.indexOf(a) < priority.indexOf(b) ? a : b
    );

    return `建议以${highestPriority}数据为准，需人工确认后进行纠偏操作`;
  }

  async correctPaidUser(recordId: string, operatorId: string, operatorName: string): Promise<CorrectionResult> {
    const record = await memoryStorage.getRecordById(recordId);
    if (!record) {
      return {
        success: false,
        businessCode: 'RECORD_NOT_FOUND',
        businessMessage: '纠偏记录不存在'
      };
    }

    if (record.correctionReason !== CorrectionReason.PAID_USER_BLOCKED_BY_OLD_RULE) {
      return {
        success: false,
        businessCode: 'INVALID_REASON',
        businessMessage: '该记录不是付费用户被限制的场景'
      };
    }

    return this.updateStatus({
      recordId,
      newStatus: CorrectionStatus.CORRECTED,
      operatorId,
      operatorName,
      remark: '已解除旧试看规则对付费用户的限制，恢复正常播放权限'
    });
  }
}

export const correctionService = new CorrectionService();
