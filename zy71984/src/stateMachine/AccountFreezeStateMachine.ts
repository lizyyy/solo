import { v4 as uuidv4 } from 'uuid';
import {
  AccountFreezeRequest,
  AccountFreezeRecord,
  AuditLog,
  StateMachineContext,
  FreezeStatus,
  ParameterIssue
} from '../types';
import { recordStore } from '../store/RecordStore';
import { findNextTransition } from './transitions';
import { validateClientParameters } from './parameterValidator';

export class AccountFreezeStateMachine {
  private context: StateMachineContext;

  constructor() {
    this.context = {
      executionId: uuidv4(),
      executedAt: new Date(),
      isReRun: false
    };
  }

  processRequest(request: AccountFreezeRequest): AccountFreezeRecord {
    const existingRecord = recordStore.findByRequestId(request.requestId);
    if (existingRecord) {
      this.context.isReRun = true;
      return this.handleReRun(existingRecord);
    }

    let record = recordStore.createRecord(request);

    const parameterIssues = validateClientParameters(request);
    if (parameterIssues.length > 0) {
      record = recordStore.updateRecord(record.recordId, {
        parameterValidationIssues: parameterIssues
      })!;
    }

    this.addAuditLog(record.recordId, {
      action: 'RECORD_CREATED',
      reason: '新的账户冻结申请已创建',
      details: {
        requestId: request.requestId,
        accountId: request.accountId,
        freezeReason: request.freezeReason,
        parameterIssueCount: parameterIssues.length
      }
    });

    return this.executeStateTransitions(record);
  }

  private handleReRun(record: AccountFreezeRecord): AccountFreezeRecord {
    this.addAuditLog(record.recordId, {
      action: 'RE_RUN_DETECTED',
      reason: '检测到重复请求，返回历史记录，不创建新记录',
      details: {
        originalCreatedAt: record.createdAt,
        originalStatus: record.status,
        isHistorical: record.isHistorical
      }
    });

    if (!record.isHistorical) {
      recordStore.markAsHistorical(record.recordId);
      record = { ...record, isHistorical: true };
    }

    return record;
  }

  private executeStateTransitions(record: AccountFreezeRecord): AccountFreezeRecord {
    let currentRecord = { ...record };
    let transitionCount = 0;
    const maxTransitions = 10;

    while (transitionCount < maxTransitions) {
      const transition = findNextTransition(currentRecord);
      if (!transition) break;

      const decisionReason = transition.decisionReason(currentRecord);
      const nextStep = transition.nextStep(currentRecord);
      const nextStepOwner = transition.nextStepOwner(currentRecord);

      this.addAuditLog(currentRecord.recordId, {
        action: 'STATE_TRANSITION',
        reason: decisionReason,
        fromStatus: currentRecord.status,
        toStatus: transition.to,
        details: {
          nextStep,
          nextStepOwner,
          transitionRule: `${currentRecord.status} -> ${transition.to}`
        }
      });

      currentRecord = recordStore.updateRecord(currentRecord.recordId, {
        status: transition.to,
        decisionReason,
        nextStep,
        nextStepOwner
      })!;

      transitionCount++;
    }

    if (transitionCount === maxTransitions) {
      this.addAuditLog(currentRecord.recordId, {
        action: 'TRANSITION_LIMIT_REACHED',
        reason: '达到最大状态转换次数，停止自动处理',
        fromStatus: currentRecord.status,
        details: { maxTransitions }
      });
    }

    return currentRecord;
  }

  private addAuditLog(recordId: string, logData: Omit<AuditLog, 'logId' | 'timestamp'>): void {
    const log: AuditLog = {
      logId: uuidv4(),
      timestamp: new Date(),
      ...logData
    };
    recordStore.addAuditLog(recordId, log);
  }

  manualTransition(
    recordId: string,
    targetStatus: FreezeStatus,
    operatorId: string,
    operatorName: string,
    reason: string
  ): AccountFreezeRecord | undefined {
    const record = recordStore.findByRecordId(recordId);
    if (!record) return undefined;

    const fromStatus = record.status;

    this.addAuditLog(recordId, {
      action: 'MANUAL_TRANSITION',
      operatorId,
      operatorName,
      reason,
      fromStatus,
      toStatus: targetStatus,
      details: {
        manualOperation: true,
        transitionType: `${fromStatus} -> ${targetStatus}`
      }
    });

    return recordStore.updateRecord(recordId, {
      status: targetStatus,
      operatorId,
      operatorName,
      decisionReason: `人工操作：${reason}`,
      nextStep: `状态已由 ${operatorName} 人工更新，请根据新状态执行后续操作`
    });
  }

  getContext(): StateMachineContext {
    return { ...this.context };
  }

  isReRun(): boolean {
    return this.context.isReRun;
  }
}

export const stateMachine = new AccountFreezeStateMachine();
