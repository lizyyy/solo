"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataSourceService = exports.NodeService = exports.WarmupService = void 0;
const dao_1 = require("../database/dao");
const types_1 = require("../models/types");
exports.WarmupService = {
    async createBatch(request) {
        const dataSource = await dao_1.DataSourceDAO.getById(request.dataSourceId);
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
        const batch = await dao_1.BatchDAO.create({
            name: request.name,
            description: request.description,
            status: types_1.BatchStatus.PENDING,
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
            status: types_1.KeyStatus.PENDING,
            dataSourceId: request.dataSourceId,
            dataQuery: key.dataQuery,
            retryCount: 0,
            maxRetries: request.maxRetries || 3
        }));
        await dao_1.CacheKeyDAO.bulkCreate(cacheKeysData);
        return {
            batch,
            totalKeys: request.cacheKeys.length,
            deduplicatedKeys: deduplicatedKeys.length,
            duplicateCount,
            message: `Batch created successfully with ${deduplicatedKeys.length} unique keys`
        };
    },
    async getBatchById(batchId) {
        const batch = await dao_1.BatchDAO.getById(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        const cacheKeys = await dao_1.CacheKeyDAO.getByBatchId(batchId);
        const failureRecords = await dao_1.FailureRecordDAO.getByBatchId(batchId);
        return {
            batch,
            cacheKeys,
            failureRecords
        };
    },
    async listBatches(limit = 100, offset = 0) {
        return dao_1.BatchDAO.list(limit, offset);
    },
    async startBatch(batchId) {
        const batch = await dao_1.BatchDAO.getById(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        if (batch.status !== types_1.BatchStatus.PENDING) {
            throw new Error(`Batch ${batchId} is not in PENDING status`);
        }
        await dao_1.BatchDAO.startBatch(batchId);
        return dao_1.BatchDAO.getById(batchId);
    },
    async updateKeyStatus(request) {
        const cacheKey = await dao_1.CacheKeyDAO.getById(request.cacheKeyId);
        if (!cacheKey) {
            throw new Error(`Cache key ${request.cacheKeyId} not found`);
        }
        const batchId = cacheKey.batchId;
        if (request.status === types_1.KeyStatus.FAILED) {
            await dao_1.CacheKeyDAO.updateStatus(request.cacheKeyId, types_1.KeyStatus.FAILED);
            await dao_1.FailureRecordDAO.create({
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
                await dao_1.RetryRecordDAO.create({
                    cacheKeyId: request.cacheKeyId,
                    batchId,
                    retryAttempt: cacheKey.retryCount + 1,
                    status: types_1.RetryStatus.PENDING,
                    nodeId: request.nodeId
                });
                await dao_1.CacheKeyDAO.incrementRetry(request.cacheKeyId);
                await dao_1.CacheKeyDAO.updateStatus(request.cacheKeyId, types_1.KeyStatus.RETRYING);
            }
        }
        else {
            await dao_1.CacheKeyDAO.updateStatus(request.cacheKeyId, request.status);
        }
        await this.recalculateBatchCounts(batchId);
        return dao_1.CacheKeyDAO.getById(request.cacheKeyId);
    },
    async recalculateBatchCounts(batchId) {
        const cacheKeys = await dao_1.CacheKeyDAO.getByBatchId(batchId);
        const successKeys = cacheKeys.filter(k => k.status === types_1.KeyStatus.SUCCESS).length;
        const failedKeys = cacheKeys.filter(k => k.status === types_1.KeyStatus.FAILED).length;
        const pendingKeys = cacheKeys.filter(k => [types_1.KeyStatus.PENDING, types_1.KeyStatus.PROCESSING, types_1.KeyStatus.RETRYING].includes(k.status)).length;
        await dao_1.BatchDAO.updateCounts(batchId, successKeys, failedKeys, pendingKeys);
        if (pendingKeys === 0) {
            const finalStatus = failedKeys === 0 ? types_1.BatchStatus.COMPLETED : types_1.BatchStatus.PARTIAL;
            await dao_1.BatchDAO.completeBatch(batchId, finalStatus);
        }
    },
    async manualFix(request) {
        const cacheKey = await dao_1.CacheKeyDAO.getById(request.cacheKeyId);
        if (!cacheKey) {
            throw new Error(`Cache key ${request.cacheKeyId} not found`);
        }
        const batchId = cacheKey.batchId;
        if (request.action === 'skip') {
            await dao_1.CacheKeyDAO.updateStatus(request.cacheKeyId, types_1.KeyStatus.SKIPPED);
            await dao_1.FailureRecordDAO.create({
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
        }
        else if (request.action === 'mark_success') {
            await dao_1.CacheKeyDAO.updateStatus(request.cacheKeyId, types_1.KeyStatus.SUCCESS);
        }
        else if (request.action === 'retry') {
            await dao_1.RetryRecordDAO.create({
                cacheKeyId: request.cacheKeyId,
                batchId,
                retryAttempt: cacheKey.retryCount + 1,
                status: types_1.RetryStatus.PENDING
            });
            await dao_1.CacheKeyDAO.incrementRetry(request.cacheKeyId);
            await dao_1.CacheKeyDAO.updateStatus(request.cacheKeyId, types_1.KeyStatus.RETRYING);
        }
        await this.recalculateBatchCounts(batchId);
        return dao_1.CacheKeyDAO.getById(request.cacheKeyId);
    },
    async getFailedKeys(batchId) {
        return dao_1.CacheKeyDAO.getByBatchIdAndStatus(batchId, types_1.KeyStatus.FAILED);
    },
    async getRetryRecords(cacheKeyId) {
        return dao_1.RetryRecordDAO.getByCacheKeyId(cacheKeyId);
    },
    async generateReport(batchId) {
        const batch = await dao_1.BatchDAO.getById(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        const failureRecords = await dao_1.FailureRecordDAO.getByBatchId(batchId);
        let duration;
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
    async exportBatchData(batchId) {
        const batch = await dao_1.BatchDAO.getById(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        const cacheKeys = await dao_1.CacheKeyDAO.getByBatchId(batchId);
        const failureRecords = await dao_1.FailureRecordDAO.getByBatchId(batchId);
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
exports.NodeService = {
    async registerNode(name, ip) {
        return dao_1.ExecutionNodeDAO.create({
            name,
            ip,
            status: types_1.NodeStatus.IDLE,
            lastHeartbeat: new Date()
        });
    },
    async heartbeat(nodeId) {
        await dao_1.ExecutionNodeDAO.updateHeartbeat(nodeId);
        return dao_1.ExecutionNodeDAO.getById(nodeId);
    },
    async updateNodeStatus(nodeId, status) {
        await dao_1.ExecutionNodeDAO.updateStatus(nodeId, status);
        return dao_1.ExecutionNodeDAO.getById(nodeId);
    },
    async listNodes() {
        return dao_1.ExecutionNodeDAO.list();
    }
};
exports.DataSourceService = {
    async createDataSource(name, type, config) {
        return dao_1.DataSourceDAO.create({
            name,
            type: type,
            config
        });
    },
    async listDataSources() {
        return dao_1.DataSourceDAO.list();
    }
};
