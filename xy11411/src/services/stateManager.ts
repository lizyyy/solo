import { v4 as uuidv4 } from 'uuid';
import {
  RecordStatus,
  StateChange,
  Operator,
  TeaMaterialRecord,
  PermissionLevel,
  AuditLog
} from '../models/types';
import { dbService } from './database';

export class StateManager {
  private operator: Operator;

  constructor(operator: Operator) {
    this.operator = operator;
  }

  getCurrentOperator(): Operator {
    return { ...this.operator };
  }

  hasPermission(required: PermissionLevel): boolean {
    const hierarchy: PermissionLevel[] = [
      PermissionLevel.VIEWER,
      PermissionLevel.OPERATOR,
      PermissionLevel.MANAGER,
      PermissionLevel.ADMIN
    ];
    const currentLevel = hierarchy.indexOf(this.operator.permission);
    const requiredLevel = hierarchy.indexOf(required);
    return currentLevel >= requiredLevel;
  }

  ensurePermission(required: PermissionLevel): void {
    if (!this.hasPermission(required)) {
      throw new Error(
        `权限不足: 需要 ${required} 权限, 当前权限为 ${this.operator.permission}`
      );
    }
  }

  async transitionState(
    recordId: string,
    fromStatus: RecordStatus | null,
    toStatus: RecordStatus,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<StateChange> {
    this.ensurePermission(PermissionLevel.OPERATOR);

    const change: StateChange = {
      id: uuidv4(),
      recordId,
      fromStatus,
      toStatus,
      operator: this.operator,
      reason,
      timestamp: Date.now(),
      metadata
    };

    await dbService.insertStateChange(change);
    await dbService.updateRecordStatus(recordId, toStatus);
    await this.logAudit('state_transition', 'record', recordId, {
      fromStatus,
      toStatus,
      reason
    });

    return change;
  }

  async transitionRecord(
    record: TeaMaterialRecord,
    toStatus: RecordStatus,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<TeaMaterialRecord> {
    const change = await this.transitionState(
      record.id,
      record.status,
      toStatus,
      reason,
      metadata
    );

    record.status = toStatus;
    record.stateChanges.push(change);
    record.updatedAt = Date.now();

    return record;
  }

  private async logAudit(
    action: string,
    resourceType: string,
    resourceId?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    const log: AuditLog = {
      id: uuidv4(),
      action,
      operatorId: this.operator.id,
      operatorName: this.operator.name,
      timestamp: Date.now(),
      resourceType,
      resourceId,
      details
    };
    await dbService.insertAuditLog(log);
  }

  async logAction(
    action: string,
    resourceType: string,
    resourceId?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logAudit(action, resourceType, resourceId, details);
  }
}

export const createStateManager = async (operatorId: string = 'default-admin'): Promise<StateManager> => {
  const operator = await dbService.getOperatorById(operatorId);
  if (!operator) {
    throw new Error(`操作员不存在: ${operatorId}`);
  }
  return new StateManager(operator);
};
