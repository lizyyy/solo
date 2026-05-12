import { v4 as uuidv4 } from 'uuid';
import {
  Member,
  Benefit,
  BenefitStatus,
  FreezeReason,
  FreezeRecord,
  OperationType,
  LedgerEntry,
  IdempotentRecord,
  ManualCorrectionDiff,
  OperationResult,
  BenefitQueryResult
} from '../types';
import { storage } from '../storage';

const MAX_COMPENSATION_DAYS = 90;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function generateId(): string {
  return uuidv4();
}

function getNow(): number {
  return Date.now();
}

function createLedgerEntry(params: {
  memberId: string;
  benefitId: string;
  operationType: OperationType;
  beforeState: { status: BenefitStatus; remainingDays: number; freezeReason?: FreezeReason };
  afterState: { status: BenefitStatus; remainingDays: number; freezeReason?: FreezeReason };
  changeDetail: string;
  operator?: string;
  requestId: string;
  success: boolean;
  failureReason?: string;
}): LedgerEntry {
  return {
    ledgerId: generateId(),
    memberId: params.memberId,
    benefitId: params.benefitId,
    operationType: params.operationType,
    beforeState: { ...params.beforeState },
    afterState: { ...params.afterState },
    changeDetail: params.changeDetail,
    operator: params.operator,
    requestId: params.requestId,
    createdAt: getNow(),
    success: params.success,
    failureReason: params.failureReason
  };
}

function saveIdempotentRecord(params: {
  requestId: string;
  operationType: OperationType;
  benefitId?: string;
  memberId: string;
  result: any;
}): void {
  const record: IdempotentRecord = {
    requestId: params.requestId,
    operationType: params.operationType,
    benefitId: params.benefitId,
    memberId: params.memberId,
    result: params.result,
    createdAt: getNow()
  };
  storage.saveIdempotentRecord(record);
}

function checkIdempotent(requestId: string): { exists: boolean; result?: any } {
  const record = storage.getIdempotentRecord(requestId);
  if (record) {
    return { exists: true, result: record.result };
  }
  return { exists: false };
}

function createFailureResult(requestId: string, message: string): OperationResult {
  return {
    success: false,
    message,
    requestId,
    isIdempotent: false
  };
}

export const benefitService = {
  createMember(params: {
    requestId: string;
    name: string;
    phone: string;
  }): OperationResult<Member> {
    const idempotentCheck = checkIdempotent(params.requestId);
    if (idempotentCheck.exists) {
      return { ...idempotentCheck.result!, isIdempotent: true };
    }

    const existingMember = storage.getMemberByPhone(params.phone);
    if (existingMember) {
      const result = createFailureResult(params.requestId, `手机号 ${params.phone} 已存在会员`);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.CREATE_MEMBER,
        memberId: existingMember.memberId,
        result
      });
      return result;
    }

    const member: Member = {
      memberId: generateId(),
      name: params.name,
      phone: params.phone,
      createdAt: getNow(),
      updatedAt: getNow()
    };

    storage.saveMember(member);

    const result: OperationResult<Member> = {
      success: true,
      data: member,
      message: '会员创建成功',
      requestId: params.requestId,
      isIdempotent: false
    };

    saveIdempotentRecord({
      requestId: params.requestId,
      operationType: OperationType.CREATE_MEMBER,
      memberId: member.memberId,
      result
    });

    return result;
  },

  grantBenefit(params: {
    requestId: string;
    memberId: string;
    benefitType: string;
    benefitName: string;
    totalDays: number;
  }): OperationResult<Benefit> {
    const idempotentCheck = checkIdempotent(params.requestId);
    if (idempotentCheck.exists) {
      return { ...idempotentCheck.result!, isIdempotent: true };
    }

    const member = storage.getMember(params.memberId);
    if (!member) {
      const result = createFailureResult(params.requestId, `会员 ${params.memberId} 不存在`);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.GRANT_BENEFIT,
        memberId: params.memberId,
        result
      });
      return result;
    }

    if (params.totalDays <= 0) {
      const result = createFailureResult(params.requestId, '权益天数必须大于0');
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.GRANT_BENEFIT,
        memberId: params.memberId,
        result
      });
      return result;
    }

    const benefit: Benefit = {
      benefitId: generateId(),
      memberId: params.memberId,
      type: params.benefitType,
      name: params.benefitName,
      totalDays: params.totalDays,
      usedDays: 0,
      remainingDays: params.totalDays,
      originalRemainingDays: params.totalDays,
      status: BenefitStatus.ACTIVE,
      freezeHistory: [],
      createdAt: getNow(),
      updatedAt: getNow(),
      expiresAt: getNow() + params.totalDays * ONE_DAY_MS
    };

    storage.saveBenefit(benefit);

    const ledgerEntry = createLedgerEntry({
      memberId: params.memberId,
      benefitId: benefit.benefitId,
      operationType: OperationType.GRANT_BENEFIT,
      beforeState: {
        status: BenefitStatus.INVALID,
        remainingDays: 0
      },
      afterState: {
        status: BenefitStatus.ACTIVE,
        remainingDays: params.totalDays
      },
      changeDetail: `发放权益: ${params.benefitName}, 类型: ${params.benefitType}, 总天数: ${params.totalDays}天`,
      requestId: params.requestId,
      success: true
    });
    storage.saveLedger(ledgerEntry);

    const result: OperationResult<Benefit> = {
      success: true,
      data: benefit,
      message: '权益发放成功',
      requestId: params.requestId,
      isIdempotent: false
    };

    saveIdempotentRecord({
      requestId: params.requestId,
      operationType: OperationType.GRANT_BENEFIT,
      benefitId: benefit.benefitId,
      memberId: params.memberId,
      result
    });

    return result;
  },

  freezeBenefit(params: {
    requestId: string;
    benefitId: string;
    reason: FreezeReason;
    detail: string;
    operator?: string;
  }): OperationResult<Benefit> {
    const idempotentCheck = checkIdempotent(params.requestId);
    if (idempotentCheck.exists) {
      return { ...idempotentCheck.result!, isIdempotent: true };
    }

    const benefit = storage.getBenefit(params.benefitId);
    if (!benefit) {
      const result = createFailureResult(params.requestId, `权益 ${params.benefitId} 不存在`);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.FREEZE,
        benefitId: params.benefitId,
        memberId: '',
        result
      });
      return result;
    }

    const beforeState = {
      status: benefit.status,
      remainingDays: benefit.remainingDays,
      freezeReason: benefit.currentFreezeReason
    };

    if (benefit.status === BenefitStatus.FROZEN) {
      const failureReason = '权益已处于冻结状态，不允许重复冻结';
      const ledgerEntry = createLedgerEntry({
        memberId: benefit.memberId,
        benefitId: benefit.benefitId,
        operationType: OperationType.FREEZE,
        beforeState,
        afterState: beforeState,
        changeDetail: `尝试冻结失败: ${failureReason}`,
        operator: params.operator,
        requestId: params.requestId,
        success: false,
        failureReason
      });
      storage.saveLedger(ledgerEntry);

      const result = createFailureResult(params.requestId, failureReason);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.FREEZE,
        benefitId: benefit.benefitId,
        memberId: benefit.memberId,
        result
      });
      return result;
    }

    if (benefit.status === BenefitStatus.REFUNDED) {
      const failureReason = '权益已退款失效，不允许冻结';
      const ledgerEntry = createLedgerEntry({
        memberId: benefit.memberId,
        benefitId: benefit.benefitId,
        operationType: OperationType.FREEZE,
        beforeState,
        afterState: beforeState,
        changeDetail: `尝试冻结失败: ${failureReason}`,
        operator: params.operator,
        requestId: params.requestId,
        success: false,
        failureReason
      });
      storage.saveLedger(ledgerEntry);

      const result = createFailureResult(params.requestId, failureReason);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.FREEZE,
        benefitId: benefit.benefitId,
        memberId: benefit.memberId,
        result
      });
      return result;
    }

    const isPermanent = params.reason === FreezeReason.REFUND;
    const freezeRecord: FreezeRecord = {
      freezeId: generateId(),
      reason: params.reason,
      detail: params.detail,
      frozenAt: getNow(),
      isPermanent
    };

    benefit.freezeHistory.push(freezeRecord);
    benefit.currentFreezeReason = params.reason;
    benefit.status = isPermanent ? BenefitStatus.REFUNDED : BenefitStatus.FROZEN;
    benefit.originalRemainingDays = benefit.remainingDays;
    benefit.updatedAt = getNow();

    if (isPermanent) {
      benefit.remainingDays = 0;
    }

    storage.saveBenefit(benefit);

    const afterState = {
      status: benefit.status,
      remainingDays: benefit.remainingDays,
      freezeReason: benefit.currentFreezeReason
    };

    const ledgerEntry = createLedgerEntry({
      memberId: benefit.memberId,
      benefitId: benefit.benefitId,
      operationType: OperationType.FREEZE,
      beforeState,
      afterState,
      changeDetail: isPermanent 
        ? `退款永久冻结: ${params.detail}, 剩余天数清零`
        : `临时冻结: 原因=${params.reason}, 详情=${params.detail}, 剩余天数=${benefit.remainingDays}天`,
      operator: params.operator,
      requestId: params.requestId,
      success: true
    });
    storage.saveLedger(ledgerEntry);

    const result: OperationResult<Benefit> = {
      success: true,
      data: benefit,
      message: isPermanent ? '权益已退款永久冻结' : '权益冻结成功',
      requestId: params.requestId,
      isIdempotent: false
    };

    saveIdempotentRecord({
      requestId: params.requestId,
      operationType: OperationType.FREEZE,
      benefitId: benefit.benefitId,
      memberId: benefit.memberId,
      result
    });

    return result;
  },

  unfreezeBenefit(params: {
    requestId: string;
    benefitId: string;
    reason: string;
    operator?: string;
  }): OperationResult<Benefit> {
    const idempotentCheck = checkIdempotent(params.requestId);
    if (idempotentCheck.exists) {
      return { ...idempotentCheck.result!, isIdempotent: true };
    }

    const benefit = storage.getBenefit(params.benefitId);
    if (!benefit) {
      const result = createFailureResult(params.requestId, `权益 ${params.benefitId} 不存在`);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.UNFREEZE,
        benefitId: params.benefitId,
        memberId: '',
        result
      });
      return result;
    }

    const beforeState = {
      status: benefit.status,
      remainingDays: benefit.remainingDays,
      freezeReason: benefit.currentFreezeReason
    };

    if (benefit.status === BenefitStatus.ACTIVE) {
      const failureReason = '权益未处于冻结状态';
      const ledgerEntry = createLedgerEntry({
        memberId: benefit.memberId,
        benefitId: benefit.benefitId,
        operationType: OperationType.UNFREEZE,
        beforeState,
        afterState: beforeState,
        changeDetail: `尝试解冻失败: ${failureReason}`,
        operator: params.operator,
        requestId: params.requestId,
        success: false,
        failureReason
      });
      storage.saveLedger(ledgerEntry);

      const result = createFailureResult(params.requestId, failureReason);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.UNFREEZE,
        benefitId: benefit.benefitId,
        memberId: benefit.memberId,
        result
      });
      return result;
    }

    if (benefit.status === BenefitStatus.REFUNDED) {
      const failureReason = '权益已退款失效，不可解冻';
      const ledgerEntry = createLedgerEntry({
        memberId: benefit.memberId,
        benefitId: benefit.benefitId,
        operationType: OperationType.UNFREEZE,
        beforeState,
        afterState: beforeState,
        changeDetail: `尝试解冻失败: ${failureReason}`,
        operator: params.operator,
        requestId: params.requestId,
        success: false,
        failureReason
      });
      storage.saveLedger(ledgerEntry);

      const result = createFailureResult(params.requestId, failureReason);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.UNFREEZE,
        benefitId: benefit.benefitId,
        memberId: benefit.memberId,
        result
      });
      return result;
    }

    const latestFreeze = benefit.freezeHistory[benefit.freezeHistory.length - 1];
    if (latestFreeze && !latestFreeze.unfrozenAt) {
      latestFreeze.unfrozenAt = getNow();
      latestFreeze.unfreezeReason = params.reason;
    }

    benefit.status = BenefitStatus.ACTIVE;
    benefit.remainingDays = benefit.originalRemainingDays;
    benefit.currentFreezeReason = undefined;
    benefit.updatedAt = getNow();

    storage.saveBenefit(benefit);

    const afterState = {
      status: benefit.status,
      remainingDays: benefit.remainingDays,
      freezeReason: benefit.currentFreezeReason
    };

    const ledgerEntry = createLedgerEntry({
      memberId: benefit.memberId,
      benefitId: benefit.benefitId,
      operationType: OperationType.UNFREEZE,
      beforeState,
      afterState,
      changeDetail: `解冻成功: 原因=${params.reason}, 恢复剩余天数=${benefit.remainingDays}天`,
      operator: params.operator,
      requestId: params.requestId,
      success: true
    });
    storage.saveLedger(ledgerEntry);

    const result: OperationResult<Benefit> = {
      success: true,
      data: benefit,
      message: '权益解冻成功，已恢复剩余天数',
      requestId: params.requestId,
      isIdempotent: false
    };

    saveIdempotentRecord({
      requestId: params.requestId,
      operationType: OperationType.UNFREEZE,
      benefitId: benefit.benefitId,
      memberId: benefit.memberId,
      result
    });

    return result;
  },

  processRefund(params: {
    requestId: string;
    benefitId: string;
    detail: string;
    operator?: string;
  }): OperationResult<Benefit> {
    return this.freezeBenefit({
      requestId: params.requestId,
      benefitId: params.benefitId,
      reason: FreezeReason.REFUND,
      detail: params.detail,
      operator: params.operator
    });
  },

  compensateBenefit(params: {
    requestId: string;
    benefitId: string;
    days: number;
    reason: string;
    operator?: string;
  }): OperationResult<Benefit> {
    const idempotentCheck = checkIdempotent(params.requestId);
    if (idempotentCheck.exists) {
      return { ...idempotentCheck.result!, isIdempotent: true };
    }

    const benefit = storage.getBenefit(params.benefitId);
    if (!benefit) {
      const result = createFailureResult(params.requestId, `权益 ${params.benefitId} 不存在`);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.COMPENSATE,
        benefitId: params.benefitId,
        memberId: '',
        result
      });
      return result;
    }

    const beforeState = {
      status: benefit.status,
      remainingDays: benefit.remainingDays,
      freezeReason: benefit.currentFreezeReason
    };

    if (params.days <= 0 || params.days > MAX_COMPENSATION_DAYS) {
      const failureReason = `补偿天数必须在1-${MAX_COMPENSATION_DAYS}天之间`;
      const ledgerEntry = createLedgerEntry({
        memberId: benefit.memberId,
        benefitId: benefit.benefitId,
        operationType: OperationType.COMPENSATE,
        beforeState,
        afterState: beforeState,
        changeDetail: `尝试补偿失败: ${failureReason}`,
        operator: params.operator,
        requestId: params.requestId,
        success: false,
        failureReason
      });
      storage.saveLedger(ledgerEntry);

      const result = createFailureResult(params.requestId, failureReason);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.COMPENSATE,
        benefitId: benefit.benefitId,
        memberId: benefit.memberId,
        result
      });
      return result;
    }

    if (benefit.status === BenefitStatus.REFUNDED) {
      const failureReason = '权益已退款失效，不允许补偿';
      const ledgerEntry = createLedgerEntry({
        memberId: benefit.memberId,
        benefitId: benefit.benefitId,
        operationType: OperationType.COMPENSATE,
        beforeState,
        afterState: beforeState,
        changeDetail: `尝试补偿失败: ${failureReason}`,
        operator: params.operator,
        requestId: params.requestId,
        success: false,
        failureReason
      });
      storage.saveLedger(ledgerEntry);

      const result = createFailureResult(params.requestId, failureReason);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.COMPENSATE,
        benefitId: benefit.benefitId,
        memberId: benefit.memberId,
        result
      });
      return result;
    }

    benefit.remainingDays += params.days;
    benefit.totalDays += params.days;
    benefit.originalRemainingDays = benefit.remainingDays;
    benefit.expiresAt = benefit.expiresAt + params.days * ONE_DAY_MS;
    benefit.updatedAt = getNow();

    storage.saveBenefit(benefit);

    const afterState = {
      status: benefit.status,
      remainingDays: benefit.remainingDays,
      freezeReason: benefit.currentFreezeReason
    };

    const ledgerEntry = createLedgerEntry({
      memberId: benefit.memberId,
      benefitId: benefit.benefitId,
      operationType: OperationType.COMPENSATE,
      beforeState,
      afterState,
      changeDetail: `人工补偿: +${params.days}天, 原因=${params.reason}, 操作人=${params.operator || '系统'}`,
      operator: params.operator,
      requestId: params.requestId,
      success: true
    });
    storage.saveLedger(ledgerEntry);

    const result: OperationResult<Benefit> = {
      success: true,
      data: benefit,
      message: `补偿成功，新增${params.days}天权益`,
      requestId: params.requestId,
      isIdempotent: false
    };

    saveIdempotentRecord({
      requestId: params.requestId,
      operationType: OperationType.COMPENSATE,
      benefitId: benefit.benefitId,
      memberId: benefit.memberId,
      result
    });

    return result;
  },

  manualCorrect(params: {
    requestId: string;
    benefitId: string;
    changes: Partial<{
      remainingDays: number;
      status: BenefitStatus;
      name: string;
    }>;
    operator: string;
    reason: string;
  }): OperationResult<{ benefit: Benefit; diffs: ManualCorrectionDiff[] }> {
    const idempotentCheck = checkIdempotent(params.requestId);
    if (idempotentCheck.exists) {
      return { ...idempotentCheck.result!, isIdempotent: true };
    }

    const benefit = storage.getBenefit(params.benefitId);
    if (!benefit) {
      const result = createFailureResult(params.requestId, `权益 ${params.benefitId} 不存在`);
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.MANUAL_CORRECT,
        benefitId: params.benefitId,
        memberId: '',
        result
      });
      return result;
    }

    const beforeState = {
      status: benefit.status,
      remainingDays: benefit.remainingDays,
      freezeReason: benefit.currentFreezeReason
    };

    const diffs: ManualCorrectionDiff[] = [];
    const changeDetails: string[] = [];

    if (params.changes.remainingDays !== undefined && params.changes.remainingDays !== benefit.remainingDays) {
      diffs.push({
        field: 'remainingDays',
        before: benefit.remainingDays,
        after: params.changes.remainingDays
      });
      changeDetails.push(`剩余天数: ${benefit.remainingDays} → ${params.changes.remainingDays}`);
      benefit.remainingDays = params.changes.remainingDays;
      benefit.originalRemainingDays = params.changes.remainingDays;
    }

    if (params.changes.status !== undefined && params.changes.status !== benefit.status) {
      diffs.push({
        field: 'status',
        before: benefit.status,
        after: params.changes.status
      });
      changeDetails.push(`状态: ${benefit.status} → ${params.changes.status}`);
      benefit.status = params.changes.status;
    }

    if (params.changes.name !== undefined && params.changes.name !== benefit.name) {
      diffs.push({
        field: 'name',
        before: benefit.name,
        after: params.changes.name
      });
      changeDetails.push(`名称: ${benefit.name} → ${params.changes.name}`);
      benefit.name = params.changes.name;
    }

    if (diffs.length === 0) {
      const result = createFailureResult(params.requestId, '没有需要修改的内容');
      saveIdempotentRecord({
        requestId: params.requestId,
        operationType: OperationType.MANUAL_CORRECT,
        benefitId: benefit.benefitId,
        memberId: benefit.memberId,
        result
      });
      return result;
    }

    benefit.updatedAt = getNow();
    storage.saveBenefit(benefit);

    const afterState = {
      status: benefit.status,
      remainingDays: benefit.remainingDays,
      freezeReason: benefit.currentFreezeReason
    };

    const ledgerEntry = createLedgerEntry({
      memberId: benefit.memberId,
      benefitId: benefit.benefitId,
      operationType: OperationType.MANUAL_CORRECT,
      beforeState,
      afterState,
      changeDetail: `人工修正: [${changeDetails.join('; ')}], 原因=${params.reason}, 操作人=${params.operator}`,
      operator: params.operator,
      requestId: params.requestId,
      success: true
    });
    storage.saveLedger(ledgerEntry);

    const result: OperationResult<{ benefit: Benefit; diffs: ManualCorrectionDiff[] }> = {
      success: true,
      data: { benefit, diffs },
      message: '人工修正成功',
      requestId: params.requestId,
      isIdempotent: false
    };

    saveIdempotentRecord({
      requestId: params.requestId,
      operationType: OperationType.MANUAL_CORRECT,
      benefitId: benefit.benefitId,
      memberId: benefit.memberId,
      result
    });

    return result;
  },

  queryBenefit(params: {
    benefitId: string;
    requestId?: string;
  }): OperationResult<BenefitQueryResult> {
    const benefit = storage.getBenefit(params.benefitId);
    if (!benefit) {
      return {
        success: false,
        message: `权益 ${params.benefitId} 不存在`,
        requestId: params.requestId || generateId(),
        isIdempotent: false
      };
    }

    const history = storage.getLedgersByBenefit(benefit.benefitId);
    
    const canUnfreeze = 
      benefit.status === BenefitStatus.FROZEN && 
      benefit.currentFreezeReason !== FreezeReason.REFUND;
    
    const canCompensate = 
      benefit.status !== BenefitStatus.REFUNDED && 
      benefit.status !== BenefitStatus.EXPIRED;

    const ledgerExplanation = this.generateLedgerExplanation(history);

    return {
      success: true,
      data: {
        benefit,
        history,
        currentState: {
          status: benefit.status,
          remainingDays: benefit.remainingDays,
          freezeReason: benefit.currentFreezeReason,
          freezeHistory: benefit.freezeHistory,
          canUnfreeze,
          canCompensate
        },
        ledgerExplanation
      },
      message: '查询成功',
      requestId: params.requestId || generateId(),
      isIdempotent: false
    };
  },

  generateLedgerExplanation(history: LedgerEntry[]): string[] {
    const explanations: string[] = [];
    
    for (const entry of history) {
      const dateStr = new Date(entry.createdAt).toLocaleString('zh-CN');
      const statusMap: Record<BenefitStatus, string> = {
        [BenefitStatus.ACTIVE]: '正常',
        [BenefitStatus.FROZEN]: '冻结',
        [BenefitStatus.REFUNDED]: '已退款',
        [BenefitStatus.EXPIRED]: '已过期',
        [BenefitStatus.COMPENSATED]: '已补偿',
        [BenefitStatus.INVALID]: '无效'
      };

      const beforeStatus = statusMap[entry.beforeState.status] || entry.beforeState.status;
      const afterStatus = statusMap[entry.afterState.status] || entry.afterState.status;

      if (entry.success) {
        explanations.push(
          `[${dateStr}] ${entry.changeDetail} (状态: ${beforeStatus} → ${afterStatus}, 天数: ${entry.beforeState.remainingDays} → ${entry.afterState.remainingDays})`
        );
      } else {
        explanations.push(
          `[${dateStr}] ❌ ${entry.changeDetail} - 失败原因: ${entry.failureReason || '未知'}`
        );
      }
    }

    return explanations;
  },

  queryMemberBenefits(params: {
    memberId: string;
    requestId?: string;
  }): OperationResult<BenefitQueryResult[]> {
    const member = storage.getMember(params.memberId);
    if (!member) {
      return {
        success: false,
        message: `会员 ${params.memberId} 不存在`,
        requestId: params.requestId || generateId(),
        isIdempotent: false
      };
    }

    const benefits = storage.getBenefitsByMember(params.memberId);
    const results: BenefitQueryResult[] = [];

    for (const benefit of benefits) {
      const queryResult = this.queryBenefit({ benefitId: benefit.benefitId });
      if (queryResult.success && queryResult.data) {
        results.push(queryResult.data);
      }
    }

    return {
      success: true,
      data: results,
      message: '查询成功',
      requestId: params.requestId || generateId(),
      isIdempotent: false
    };
  },

  getMember(params: {
    memberId: string;
  }): OperationResult<Member> {
    const member = storage.getMember(params.memberId);
    if (!member) {
      return {
        success: false,
        message: `会员 ${params.memberId} 不存在`,
        requestId: generateId(),
        isIdempotent: false
      };
    }

    return {
      success: true,
      data: member,
      message: '查询成功',
      requestId: generateId(),
      isIdempotent: false
    };
  },

  exportReport(params: {
    memberId?: string;
    benefitId?: string;
  }): OperationResult<any[]> {
    let ledgers: LedgerEntry[];

    if (params.benefitId) {
      const benefit = storage.getBenefit(params.benefitId);
      if (!benefit) {
        return {
          success: false,
          message: `权益 ${params.benefitId} 不存在`,
          requestId: generateId(),
          isIdempotent: false
        };
      }
      ledgers = storage.getLedgersByBenefit(params.benefitId);
    } else if (params.memberId) {
      const member = storage.getMember(params.memberId);
      if (!member) {
        return {
          success: false,
          message: `会员 ${params.memberId} 不存在`,
          requestId: generateId(),
          isIdempotent: false
        };
      }
      ledgers = storage.getLedgersByMember(params.memberId);
    } else {
      ledgers = storage.getAllLedgers();
    }

    const report = ledgers.map(entry => ({
      时间: new Date(entry.createdAt).toLocaleString('zh-CN'),
      操作类型: entry.operationType,
      会员ID: entry.memberId,
      权益ID: entry.benefitId,
      操作前状态: entry.beforeState.status,
      操作后状态: entry.afterState.status,
      操作前剩余天数: entry.beforeState.remainingDays,
      操作后剩余天数: entry.afterState.remainingDays,
      操作详情: entry.changeDetail,
      操作人: entry.operator || '系统',
      是否成功: entry.success ? '是' : '否',
      失败原因: entry.failureReason || '-',
      请求ID: entry.requestId
    }));

    return {
      success: true,
      data: report,
      message: '报告导出成功',
      requestId: generateId(),
      isIdempotent: false
    };
  },

  clearAll(): void {
    storage.clearAll();
  },

  getAllData(): {
    members: Member[];
    benefits: Benefit[];
    ledgers: LedgerEntry[];
  } {
    return {
      members: storage.getAllMembers(),
      benefits: storage.getAllBenefits(),
      ledgers: storage.getAllLedgers()
    };
  }
};
