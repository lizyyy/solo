import {
  BatchDAO,
  CacheKeyDAO,
  FailureRecordDAO,
  RetryRecordDAO,
  DataSourceDAO,
  ExecutionNodeDAO
} from '../database/dao';
import {
  BatchStatus,
  KeyStatus,
  RetryStatus,
  NodeStatus,
  CreateBatchRequest,
  KeyResultRequest,
  ManualFixRequest,
  WarmupReport
} from '../models/types';

export const WarmupService = {
  async createBatch(request: CreateBatchRequest) {
    const dataSource = await DataSourceDAO.getById(request.dataSourceId);
    if (!dataSource) {
      throw new Error(`Data source ${request.dataSourceId} not found`);
    }

    const uniqueKeys = new Map();
    for (const key of request.cacheKeys) {
      if (!uniqueKeys.has(key.key)) {
        uniqueKeys.set(key.key, key);
      }
    }

    const deduplicatedKeys = Array.from(uniqueKeys.values());
    const duplicateCount = request.cacheKeys.length - deduplicatedKeys.length;

    const batch = await BatchDAO.create({
      name: request.name,
      description: request.description,
      status: BatchStatus.PENDING,
      totalKeys: deduplicatedKeys.length,
      successKeys: 0,
      failedKeys: 0,
      pendingKeys: deduplicatedKeys.length,
      dataSourceId: request.dataSourceId,
      priority: request.priority || 0,
      scheduledAt: request.scheduledAt,
      createdBy: request.createdBy
    });

    const cacheKeysData = deduplicatedKeys.map(key => ({
      batchId: batch.id,
      cacheKey: key.key,
      cacheType: key.type,
      ttl: key.ttl,
      status: KeyStatus.PENDING,
      dataSourceId: request.dataSourceId,
      dataQuery: key.dataQuery,
      retryCount: 0,
      maxRetries: request.maxRetries || 3
    }));

    await CacheKeyDAO.bulkCreate(cacheKeysData);

    return {
      batch,
      totalKeys: request.cacheKeys.length,
      deduplicatedKeys: deduplicatedKeys.length,
      duplicateCount,
      message: `Batch created successfully with ${deduplicatedKeys.length} unique keys`
    };
  },

  async getBatchById(batchId: string) {
    const batch = await BatchDAO.getById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const cacheKeys = await CacheKeyDAO.getByBatchId(batchId);
    const failureRecords = await FailureRecordDAO.getByBatchId(batchId);

    return {
      batch,
      cacheKeys,
      failureRecords
    };
  },

  async listBatches(limit: number = 100, offset: number = 0) {
    return BatchDAO.list(limit, offset);
  },

  async startBatch(batchId: string) {
    const batch = await BatchDAO.getById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status !== BatchStatus.PENDING) {
      throw new Error(`Batch ${batchId} is not in PENDING status`);
    }

    await BatchDAO.startBatch(batchId);
    return BatchDAO.getById(batchId);
  },

  async updateKeyStatus(request: KeyResultRequest) {
    const cacheKey = await CacheKeyDAO.getById(request.cacheKeyId);
    if (!cacheKey) {
      throw new Error(`Cache key ${request.cacheKeyId} not found`);
    }

    const batchId = cacheKey.batchId;

    if (request.status === KeyStatus.FAILED) {
      await CacheKeyDAO.updateStatus(request.cacheKeyId, KeyStatus.FAILED);
      
      await FailureRecordDAO.create({
        cacheKeyId: request.cacheKeyId,
        batchId,
        originalInput: JSON.stringify({
          cacheKey: cacheKey.cacheKey,
          cacheType: cacheKey.cacheType,
          dataQuery: cacheKey.dataQuery
        }),
        processingBasis: request.processingBasis || 'Standard warmup flow',
        errorMessage: request.errorMessage || 'Unknown error',
        finalConclusion: cacheKey.retryCount < cacheKey.maxRetries 
          ? 'Will retry' 
          : 'Max retries reached, marked as failed',
        nodeId: request.nodeId,
        occurredAt: new Date()
      });

      if (cacheKey.retryCount < cacheKey.maxRetries) {
        await RetryRecordDAO.create({
          cacheKeyId: request.cacheKeyId,
          batchId,
          retryAttempt: cacheKey.retryCount + 1,
          status: RetryStatus.PENDING,
          nodeId: request.nodeId
        });
        await CacheKeyDAO.incrementRetry(request.cacheKeyId);
        await CacheKeyDAO.updateStatus(request.cacheKeyId, KeyStatus.RETRYING);
      }
    } else {
      await CacheKeyDAO.updateStatus(request.cacheKeyId, request.status);
    }

    await this.recalculateBatchCounts(batchId);
    return CacheKeyDAO.getById(request.cacheKeyId);
  },

  async recalculateBatchCounts(batchId: string) {
    const cacheKeys = await CacheKeyDAO.getByBatchId(batchId);
    
    const successKeys = cacheKeys.filter(k => k.status === KeyStatus.SUCCESS).length;
    const failedKeys = cacheKeys.filter(k => k.status === KeyStatus.FAILED).length;
    const pendingKeys = cacheKeys.filter(k => 
      [KeyStatus.PENDING, KeyStatus.PROCESSING, KeyStatus.RETRYING].includes(k.status)
    ).length;

    await BatchDAO.updateCounts(batchId, successKeys, failedKeys, pendingKeys);

    if (pendingKeys === 0) {
      const finalStatus = failedKeys === 0 ? BatchStatus.COMPLETED : BatchStatus.PARTIAL;
      await BatchDAO.completeBatch(batchId, finalStatus);
    }
  },

  async manualFix(request: ManualFixRequest) {
    const cacheKey = await CacheKeyDAO.getById(request.cacheKeyId);
    if (!cacheKey) {
      throw new Error(`Cache key ${request.cacheKeyId} not found`);
    }

    const batchId = cacheKey.batchId;

    if (request.action === 'skip') {
      await CacheKeyDAO.updateStatus(request.cacheKeyId, KeyStatus.SKIPPED);
      await FailureRecordDAO.create({
        cacheKeyId: request.cacheKeyId,
        batchId,
        originalInput: JSON.stringify({
          cacheKey: cacheKey.cacheKey,
          cacheType: cacheKey.cacheType,
          dataQuery: cacheKey.dataQuery
        }),
        processingBasis: `Manual skip by operator: ${request.operator}`,
        errorMessage: `Manually skipped. Reason: ${request.reason}`,
        finalConclusion: 'Skipped by manual intervention',
        occurredAt: new Date()
      });
    } else if (request.action === 'mark_success') {
      await CacheKeyDAO.updateStatus(request.cacheKeyId, KeyStatus.SUCCESS);
    } else if (request.action === 'retry') {
      await RetryRecordDAO.create({
        cacheKeyId: request.cacheKeyId,
        batchId,
        retryAttempt: cacheKey.retryCount + 1,
        status: RetryStatus.PENDING
      });
      await CacheKeyDAO.incrementRetry(request.cacheKeyId);
      await CacheKeyDAO.updateStatus(request.cacheKeyId, KeyStatus.RETRYING);
    }

    await this.recalculateBatchCounts(batchId);
    return CacheKeyDAO.getById(request.cacheKeyId);
  },

  async getFailedKeys(batchId: string) {
    return CacheKeyDAO.getByBatchIdAndStatus(batchId, KeyStatus.FAILED);
  },

  async getRetryRecords(cacheKeyId: string) {
    return RetryRecordDAO.getByCacheKeyId(cacheKeyId);
  },

  async generateReport(batchId: string): Promise<WarmupReport> {
    const batch = await BatchDAO.getById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const failureRecords = await FailureRecordDAO.getByBatchId(batchId);

    let duration: number | undefined;
    if (batch.startedAt && batch.completedAt) {
      duration = batch.completedAt.getTime() - batch.startedAt.getTime();
    }

    return {
      batchId: batch.id,
      batchName: batch.name,
      status: batch.status,
      totalKeys: batch.totalKeys,
      successKeys: batch.successKeys,
      failedKeys: batch.failedKeys,
      pendingKeys: batch.pendingKeys,
      successRate: batch.totalKeys > 0 
        ? Math.round((batch.successKeys / batch.totalKeys) * 10000) / 100 
        : 0,
      duration,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      failureDetails: failureRecords
    };
  },

  async exportBatchData(batchId: string) {
    const batch = await BatchDAO.getById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const cacheKeys = await CacheKeyDAO.getByBatchId(batchId);
    const failureRecords = await FailureRecordDAO.getByBatchId(batchId);

    const exportData = cacheKeys.map(key => {
      const failures = failureRecords.filter(f => f.cacheKeyId === key.id);
      return {
        batchId: key.batchId,
        batchName: batch.name,
        cacheKey: key.cacheKey,
        cacheType: key.cacheType,
        ttl: key.ttl,
        status: key.status,
        retryCount: key.retryCount,
        maxRetries: key.maxRetries,
        dataSourceId: key.dataSourceId,
        dataQuery: key.dataQuery,
        assignedNodeId: key.assignedNodeId,
        startedAt: key.startedAt?.toISOString(),
        completedAt: key.completedAt?.toISOString(),
        failureCount: failures.length,
        lastError: failures.length > 0 ? failures[0].errorMessage : null,
        createdAt: key.createdAt.toISOString()
      };
    });

    return {
      batch,
      records: exportData,
      exportTime: new Date().toISOString(),
      totalRecords: exportData.length
    };
  }
};

export const NodeService = {
  async registerNode(name: string, ip: string) {
    return ExecutionNodeDAO.create({
      name,
      ip,
      status: NodeStatus.IDLE,
      lastHeartbeat: new Date()
    });
  },

  async heartbeat(nodeId: string) {
    await ExecutionNodeDAO.updateHeartbeat(nodeId);
    return ExecutionNodeDAO.getById(nodeId);
  },

  async updateNodeStatus(nodeId: string, status: NodeStatus) {
    await ExecutionNodeDAO.updateStatus(nodeId, status);
    return ExecutionNodeDAO.getById(nodeId);
  },

  async listNodes() {
    return ExecutionNodeDAO.list();
  }
};

export const DataSourceService = {
  async createDataSource(name: string, type: string, config: Record<string, any>) {
    return DataSourceDAO.create({
      name,
      type: type as any,
      config
    });
  },

  async listDataSources() {
    return DataSourceDAO.list();
  }
};
