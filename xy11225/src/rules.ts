import { FaultRecord, RuleValidationResult, RecordStatus, ProcessingResult } from './types';
import { storage } from './storage';

export class RuleEngine {
  private rules: Array<{
    name: string;
    validate: (record: FaultRecord, existingRecords: FaultRecord[]) => RuleValidationResult;
  }> = [];

  constructor() {
    this.registerRules();
  }

  private registerRules(): void {
    this.rules.push({
      name: '离线柜排除',
      validate: this.offlineCabinetRule.bind(this)
    });
    
    this.rules.push({
      name: '重复故障合并',
      validate: this.duplicateFaultRule.bind(this)
    });
    
    this.rules.push({
      name: '维修前后状态一致校验',
      validate: this.maintenanceStatusRule.bind(this)
    });
  }

  private offlineCabinetRule(record: FaultRecord): RuleValidationResult {
    const isOffline = storage.isCabinetOffline(record.cabinetId);
    if (isOffline) {
      return {
        passed: false,
        reason: `柜子 ${record.cabinetId} 处于离线状态，已拦截`,
        action: 'block'
      };
    }
    return {
      passed: true,
      reason: `柜子 ${record.cabinetId} 在线，放行`,
      action: 'allow'
    };
  }

  private duplicateFaultRule(
    record: FaultRecord,
    existingRecords: FaultRecord[]
  ): RuleValidationResult {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const duplicate = existingRecords.find(r => 
      r.id !== record.id &&
      r.cabinetId === record.cabinetId &&
      r.faultType === record.faultType &&
      r.createdAt >= oneHourAgo &&
      r.status !== RecordStatus.MERGED
    );

    if (duplicate) {
      return {
        passed: false,
        reason: `检测到1小时内相同故障（柜子 ${record.cabinetId}，${record.faultType}），已合并到记录 ${duplicate.id.slice(0, 8)}`,
        action: 'merge',
        relatedRecordId: duplicate.id
      };
    }

    return {
      passed: true,
      reason: '无重复故障，放行',
      action: 'allow'
    };
  }

  private maintenanceStatusRule(
    record: FaultRecord,
    existingRecords: FaultRecord[]
  ): RuleValidationResult {
    const cabinetRecords = existingRecords.filter(r => r.cabinetId === record.cabinetId);
    const lastResolved = cabinetRecords
      .filter(r => r.status === RecordStatus.RESOLVED)
      .sort((a, b) => new Date(b.resolvedAt || b.updatedAt).getTime() - new Date(a.resolvedAt || a.updatedAt).getTime())[0];

    if (lastResolved) {
      const timeSinceResolve = Date.now() - new Date(lastResolved.resolvedAt || lastResolved.updatedAt).getTime();
      const hoursSinceResolve = timeSinceResolve / (1000 * 60 * 60);

      if (hoursSinceResolve < 24) {
        return {
          passed: true,
          reason: `注意：柜子 ${record.cabinetId} 在 ${hoursSinceResolve.toFixed(1)} 小时前刚维修解决，建议检查维修质量`,
          action: 'flag'
        };
      }
    }

    return {
      passed: true,
      reason: '维修状态校验通过',
      action: 'allow'
    };
  }

  validateRecord(record: FaultRecord): {
    overallResult: ProcessingResult;
    results: Array<{
      ruleName: string;
      validation: RuleValidationResult;
    }>;
    primaryReason: string;
    targetRecordId?: string;
  } {
    const existingRecords = storage.getRecords();
    const results: Array<{
      ruleName: string;
      validation: RuleValidationResult;
    }> = [];

    let overallResult = ProcessingResult.ALLOWED;
    let primaryReason = '';
    let targetRecordId: string | undefined;
    let hasBlock = false;
    let hasMerge = false;

    for (const rule of this.rules) {
      const validation = rule.validate(record, existingRecords);
      results.push({
        ruleName: rule.name,
        validation
      });

      if (validation.action === 'block' && !hasBlock) {
        hasBlock = true;
        overallResult = ProcessingResult.BLOCKED;
        primaryReason = validation.reason;
      } else if (validation.action === 'merge' && !hasBlock && !hasMerge) {
        hasMerge = true;
        overallResult = ProcessingResult.BLOCKED;
        primaryReason = validation.reason;
        targetRecordId = validation.relatedRecordId;
      } else if (!primaryReason && validation.action === 'flag') {
        primaryReason = validation.reason;
      }
    }

    if (!primaryReason) {
      primaryReason = '所有规则校验通过，已放行';
    }

    return {
      overallResult,
      results,
      primaryReason,
      targetRecordId
    };
  }

  processRecord(record: FaultRecord): {
    record: FaultRecord;
    overallResult: ProcessingResult;
    reason: string;
    mergedTo?: string;
  } {
    const validation = this.validateRecord(record);
    
    let processedRecord = record;
    let mergedTo: string | undefined;

    if (validation.targetRecordId) {
      const targetRecord = storage.getRecord(validation.targetRecordId);
      if (targetRecord) {
        storage.updateRecord(validation.targetRecordId, {
          mergedFrom: [...(targetRecord.mergedFrom || []), record.id]
        });
        storage.updateRecord(record.id, {
          status: RecordStatus.MERGED,
          processingResult: validation.overallResult,
          processingReason: validation.primaryReason
        });
        mergedTo = validation.targetRecordId;
      }
    } else {
      storage.updateRecord(record.id, {
        processingResult: validation.overallResult,
        processingReason: validation.primaryReason
      });
    }

    const updatedRecord = storage.getRecord(record.id);
    if (updatedRecord) {
      processedRecord = updatedRecord;
    }

    return {
      record: processedRecord,
      overallResult: validation.overallResult,
      reason: validation.primaryReason,
      mergedTo
    };
  }
}

export const ruleEngine = new RuleEngine();
