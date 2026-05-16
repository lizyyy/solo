import { v4 as uuidv4 } from 'uuid';
import {
  SchemaCanary,
  CreateCanaryRequest,
  StatusTransitionRequest,
  ManualCorrectionRequest,
  CanaryStatus,
  Consumer,
  FailureRecord,
  CompatibilityIssue,
  RevocationRecord
} from './types';
import { validateTransition, getTargetStatus } from './stateMachine';

class CanaryStore {
  private canaries: Map<string, SchemaCanary> = new Map();

  create(request: CreateCanaryRequest): SchemaCanary {
    const now = new Date();
    const consumers: Consumer[] = request.consumerIds.map(id => ({
      id,
      name: `consumer-${id}`
    }));

    const canary: SchemaCanary = {
      id: uuidv4(),
      schemaName: request.schemaName,
      schemaVersion: request.schemaVersion,
      schemaContent: request.schemaContent,
      consumers,
      canaryRatio: Math.min(Math.max(request.canaryRatio, 0), 100),
      status: CanaryStatus.PENDING,
      statusHistory: [{
        status: CanaryStatus.PENDING,
        changedAt: now
      }],
      revocationRecords: [],
      failureRecords: [],
      compatibilityIssues: [],
      createdBy: request.createdBy,
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata
    };

    this.canaries.set(canary.id, canary);
    return canary;
  }

  getById(id: string): SchemaCanary | undefined {
    return this.canaries.get(id);
  }

  list(filters?: {
    schemaName?: string;
    status?: CanaryStatus;
    consumerId?: string;
  }): SchemaCanary[] {
    let results = Array.from(this.canaries.values());

    if (filters?.schemaName) {
      results = results.filter(c => c.schemaName === filters.schemaName);
    }
    if (filters?.status) {
      results = results.filter(c => c.status === filters.status);
    }
    if (filters?.consumerId) {
      results = results.filter(c => 
        c.consumers.some(consumer => consumer.id === filters.consumerId)
      );
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  transitionStatus(
    id: string,
    request: StatusTransitionRequest
  ): SchemaCanary {
    const canary = this.canaries.get(id);
    if (!canary) {
      throw new Error(`Canary not found: ${id}`);
    }

    const validation = validateTransition(canary, request.transitionType);
    if (!validation.valid) {
      this.addFailureRecord(canary, {
        step: 'status_transition',
        originalInput: request,
        processingBasis: `当前状态: ${canary.status}, 尝试转换: ${request.transitionType}`,
        finalConclusion: validation.reason || '转换验证失败'
      });
      throw new Error(validation.reason);
    }

    const targetStatus = getTargetStatus(request.transitionType);
    const now = new Date();

    if (targetStatus === CanaryStatus.REVOKED) {
      canary.revocationRecords.push({
        id: uuidv4(),
        reason: request.reason,
        revokedBy: request.operatedBy,
        revokedAt: now,
        originalStatus: canary.status
      });
    }

    if (request.consumerId) {
      const consumer = canary.consumers.find(c => c.id === request.consumerId);
      if (consumer) {
        consumer.confirmedAt = now;
        consumer.confirmedBy = request.operatedBy;
      }
    }

    canary.status = targetStatus;
    canary.statusHistory.push({
      status: targetStatus,
      changedAt: now,
      changedBy: request.operatedBy,
      reason: request.reason
    });
    canary.updatedAt = now;

    return canary;
  }

  manualCorrect(
    id: string,
    request: ManualCorrectionRequest
  ): SchemaCanary {
    const canary = this.canaries.get(id);
    if (!canary) {
      throw new Error(`Canary not found: ${id}`);
    }

    const now = new Date();

    if (request.status !== undefined && request.status !== canary.status) {
      canary.status = request.status;
      canary.statusHistory.push({
        status: request.status,
        changedAt: now,
        changedBy: request.correctedBy,
        reason: `人工修正: ${request.correctionReason}`
      });
    }

    if (request.canaryRatio !== undefined) {
      canary.canaryRatio = Math.min(Math.max(request.canaryRatio, 0), 100);
    }

    if (request.consumers !== undefined) {
      canary.consumers = request.consumers;
    }

    canary.updatedAt = now;
    return canary;
  }

  checkCompatibility(
    id: string,
    previousSchema: string
  ): CompatibilityIssue[] {
    const canary = this.canaries.get(id);
    if (!canary) {
      throw new Error(`Canary not found: ${id}`);
    }

    const issues: CompatibilityIssue[] = [];

    try {
      const newSchema = JSON.parse(canary.schemaContent);
      const oldSchema = JSON.parse(previousSchema);

      const newFields = Object.keys(newSchema.properties || {});
      const oldFields = Object.keys(oldSchema.properties || {});

      for (const field of oldFields) {
        if (!newFields.includes(field)) {
          issues.push({
            type: 'breaking',
            field,
            message: `字段 "${field}" 被移除，这是破坏性变更`
          });
        }
      }

      for (const field of newFields) {
        if (!oldFields.includes(field)) {
          issues.push({
            type: 'warning',
            field,
            message: `新增字段 "${field}"`
          });
        }
      }

      canary.compatibilityIssues = issues;
      canary.updatedAt = new Date();
    } catch (error) {
      this.addFailureRecord(canary, {
        step: 'compatibility_check',
        originalInput: { previousSchema },
        processingBasis: 'Schema JSON解析',
        finalConclusion: '兼容校验失败',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    return issues;
  }

  addFailureRecord(canary: SchemaCanary, record: Omit<FailureRecord, 'failedAt'>): void {
    canary.failureRecords.push({
      ...record,
      failedAt: new Date()
    });
    canary.updatedAt = new Date();
  }

  exportForConfirmation(id: string): Record<string, unknown> {
    const canary = this.canaries.get(id);
    if (!canary) {
      throw new Error(`Canary not found: ${id}`);
    }

    return {
      id: canary.id,
      schemaName: canary.schemaName,
      schemaVersion: canary.schemaVersion,
      canaryRatio: canary.canaryRatio,
      status: canary.status,
      consumers: canary.consumers.map(c => ({
        id: c.id,
        name: c.name,
        confirmed: !!c.confirmedAt,
        confirmedAt: c.confirmedAt
      })),
      statusHistory: canary.statusHistory,
      revocationRecords: canary.revocationRecords,
      compatibilityIssues: canary.compatibilityIssues,
      createdAt: canary.createdAt,
      createdBy: canary.createdBy
    };
  }
}

export const canaryStore = new CanaryStore();