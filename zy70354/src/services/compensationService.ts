import { v4 as uuidv4 } from 'uuid';
import { CompensationWriteRequest, ShardTarget, WriteStrategy, MigrationStatus } from '../types';
import { configService } from './configService';
import { routingEngine } from './routingEngine';
import { auditService } from '../utils/audit';

class CompensationService {
  private pendingCompensations: Map<string, CompensationWriteRequest[]> = new Map();

  createCompensationRequest(
    orderId: string,
    tenantId: string,
    failedShardId: string,
    originalWriteTimestamp: string,
    operation: 'insert' | 'update' | 'delete',
    data: Record<string, any>
  ): CompensationWriteRequest {
    const request: CompensationWriteRequest = {
      orderId,
      tenantId,
      failedShardId,
      originalWriteTimestamp,
      operation,
      data,
      retryCount: 0,
    };

    const existing = this.pendingCompensations.get(tenantId) || [];
    existing.push(request);
    this.pendingCompensations.set(tenantId, existing);

    auditService.createRecord(
      'COMPENSATION_QUEUED',
      failedShardId,
      'compensation',
      {
        orderId,
        operation,
        originalWriteTimestamp,
      },
      'compensation-service'
    );

    return request;
  }

  getPendingCompensations(tenantId: string): CompensationWriteRequest[] {
    return this.pendingCompensations.get(tenantId) || [];
  }

  getAllPendingCompensations(): Map<string, CompensationWriteRequest[]> {
    return new Map(this.pendingCompensations);
  }

  processCompensation(
    request: CompensationWriteRequest
  ): {
    success: boolean;
    updatedRequest: CompensationWriteRequest;
    targetShard?: ShardTarget;
    message: string;
  } {
    const tenantConfig = configService.getTenantConfig(request.tenantId);
    if (!tenantConfig) {
      return {
        success: false,
        updatedRequest: request,
        message: '租户配置不存在',
      };
    }

    const shardConfig = configService.getShardConfig(request.failedShardId);
    if (!shardConfig) {
      return {
        success: false,
        updatedRequest: request,
        message: '目标分片配置不存在',
      };
    }

    const maxRetries = 3;
    if (request.retryCount >= maxRetries) {
      auditService.createRecord(
        'COMPENSATION_FAILED_PERMANENTLY',
        request.failedShardId,
        'compensation',
        {
          orderId: request.orderId,
          operation: request.operation,
          retryCount: request.retryCount,
          error: '超过最大重试次数',
        },
        'compensation-service'
      );

      const tenantRequests = this.pendingCompensations.get(request.tenantId) || [];
      const updatedRequests = tenantRequests.filter(
        r => r.orderId !== request.orderId || r.failedShardId !== request.failedShardId
      );
      this.pendingCompensations.set(request.tenantId, updatedRequests);

      return {
        success: false,
        updatedRequest: { ...request, retryCount: request.retryCount + 1 },
        message: '补偿失败：超过最大重试次数，需要人工干预',
      };
    }

    const targetShard: ShardTarget = {
      shardId: shardConfig.shardId,
      database: shardConfig.database,
      table: shardConfig.table,
      isHistorical: shardConfig.isHistorical,
      confidence: 1.0,
      reason: `补偿写入：${request.operation} 操作到失败分片`,
    };

    const simulatedSuccess = Math.random() > 0.3;

    if (simulatedSuccess) {
      const tenantRequests = this.pendingCompensations.get(request.tenantId) || [];
      const updatedRequests = tenantRequests.filter(
        r => r.orderId !== request.orderId || r.failedShardId !== request.failedShardId
      );
      this.pendingCompensations.set(request.tenantId, updatedRequests);

      auditService.createRecord(
        'COMPENSATION_SUCCEEDED',
        request.failedShardId,
        'compensation',
        {
          orderId: request.orderId,
          operation: request.operation,
          retryCount: request.retryCount,
        },
        'compensation-service'
      );

      return {
        success: true,
        updatedRequest: request,
        targetShard,
        message: `补偿成功：${request.operation} 订单 ${request.orderId} 到分片 ${request.failedShardId}`,
      };
    } else {
      const updatedRequest = {
        ...request,
        retryCount: request.retryCount + 1,
      };

      const tenantRequests = this.pendingCompensations.get(request.tenantId) || [];
      const updatedRequests = tenantRequests.map(r =>
        (r.orderId === request.orderId && r.failedShardId === request.failedShardId)
          ? updatedRequest
          : r
      );
      this.pendingCompensations.set(request.tenantId, updatedRequests);

      auditService.createRecord(
        'COMPENSATION_RETRY',
        request.failedShardId,
        'compensation',
        {
          orderId: request.orderId,
          operation: request.operation,
          retryCount: updatedRequest.retryCount,
        },
        'compensation-service'
      );

      return {
        success: false,
        updatedRequest,
        message: `补偿失败：第 ${updatedRequest.retryCount} 次重试失败，将继续重试`,
      };
    }
  }

  checkForConflicts(
    tenantId: string,
    orderId: string
  ): {
    hasConflict: boolean;
    shardConflicts: {
      shardId: string;
      pendingOperation: string;
    }[];
  } {
    const pending = this.getPendingCompensations(tenantId);
    const orderCompensations = pending.filter(c => c.orderId === orderId);

    return {
      hasConflict: orderCompensations.length > 0,
      shardConflicts: orderCompensations.map(c => ({
        shardId: c.failedShardId,
        pendingOperation: c.operation,
      })),
    };
  }

  handleDuplicateWrite(
    tenantId: string,
    orderId: string
  ): {
    shouldProceed: boolean;
    existingOperations: string[];
    recommendation: string;
  } {
    const conflict = this.checkForConflicts(tenantId, orderId);

    if (conflict.hasConflict) {
      const operations = conflict.shardConflicts.map(c => `${c.pendingOperation}@${c.shardId}`);
      return {
        shouldProceed: false,
        existingOperations: operations,
        recommendation: '存在未完成的补偿操作，建议先处理补偿或使用幂等写入',
      };
    }

    return {
      shouldProceed: true,
      existingOperations: [],
      recommendation: '无冲突，可以执行写入',
    };
  }

  resolveMigrationConflict(
    tenantId: string,
    oldData: any,
    newData: any
  ): {
    resolution: 'use_old' | 'use_new' | 'pending' | 'error';
    conflicts: string[];
    recommendation: string;
  } {
    const conflictResult = routingEngine.resolveDualReadConflict(oldData, newData);

    if (!conflictResult.hasConflict) {
      return {
        resolution: conflictResult.resolution as 'use_old' | 'use_new' | 'pending' | 'error',
        conflicts: [],
        recommendation: '无数据冲突',
      };
    }

    const conflictFields = conflictResult.conflictDetails?.map(c => c.field) || [];

    const tenantConfig = configService.getTenantConfig(tenantId);
    const currentTime = new Date();
    const migrationEnd = tenantConfig?.migrationEndDate
      ? new Date(tenantConfig.migrationEndDate)
      : null;

    if (migrationEnd && currentTime > migrationEnd) {
      return {
        resolution: 'use_new',
        conflicts: conflictFields,
        recommendation: '迁移已完成，使用新分片数据',
      };
    }

    if (tenantConfig?.migrationStatus === MigrationStatus.IN_PROGRESS) {
      return {
        resolution: 'pending',
        conflicts: conflictFields,
        recommendation: '迁移进行中，冲突字段需要人工或自动化规则判定',
      };
    }

    return {
      resolution: 'error',
      conflicts: conflictFields,
      recommendation: '无法自动解决冲突，需要人工处理',
    };
  }
}

export const compensationService = new CompensationService();
