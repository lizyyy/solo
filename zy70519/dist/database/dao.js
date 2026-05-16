"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionNodeDAO = exports.DataSourceDAO = exports.RetryRecordDAO = exports.FailureRecordDAO = exports.CacheKeyDAO = exports.BatchDAO = void 0;
const uuid_1 = require("uuid");
const init_1 = require("./init");
const types_1 = require("../models/types");
const db = (0, init_1.getDatabase)();
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
};
const getOne = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row || null);
        });
    });
};
const getAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
exports.BatchDAO = {
    async create(data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await runQuery(`
      INSERT INTO warmup_batches (
        id, name, description, status, total_keys, success_keys, failed_keys,
        pending_keys, data_source_id, assigned_node_id, priority, scheduled_at,
        started_at, completed_at, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id, data.name, data.description || null, data.status, data.totalKeys,
            data.successKeys, data.failedKeys, data.pendingKeys, data.dataSourceId,
            data.assignedNodeId || null, data.priority, data.scheduledAt?.toISOString() || null,
            data.startedAt?.toISOString() || null, data.completedAt?.toISOString() || null,
            data.createdBy, now, now
        ]);
        return this.getById(id);
    },
    async getById(id) {
        const row = await getOne(`
      SELECT * FROM warmup_batches WHERE id = ?
    `, [id]);
        if (!row)
            return null;
        return this.mapRow(row);
    },
    async list(limit = 100, offset = 0) {
        const rows = await getAll(`
      SELECT * FROM warmup_batches ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [limit, offset]);
        return rows.map(row => this.mapRow(row));
    },
    async updateStatus(id, status) {
        const now = new Date().toISOString();
        await runQuery(`
      UPDATE warmup_batches SET status = ?, updated_at = ? WHERE id = ?
    `, [status, now, id]);
    },
    async updateCounts(id, successKeys, failedKeys, pendingKeys) {
        const now = new Date().toISOString();
        await runQuery(`
      UPDATE warmup_batches 
      SET success_keys = ?, failed_keys = ?, pending_keys = ?, updated_at = ?
      WHERE id = ?
    `, [successKeys, failedKeys, pendingKeys, now, id]);
    },
    async startBatch(id) {
        const now = new Date().toISOString();
        await runQuery(`
      UPDATE warmup_batches SET status = ?, started_at = ?, updated_at = ? WHERE id = ?
    `, [types_1.BatchStatus.RUNNING, now, now, id]);
    },
    async completeBatch(id, status) {
        const now = new Date().toISOString();
        await runQuery(`
      UPDATE warmup_batches SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
    `, [status, now, now, id]);
    },
    mapRow(row) {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            status: row.status,
            totalKeys: row.total_keys,
            successKeys: row.success_keys,
            failedKeys: row.failed_keys,
            pendingKeys: row.pending_keys,
            dataSourceId: row.data_source_id,
            assignedNodeId: row.assigned_node_id,
            priority: row.priority,
            scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            createdBy: row.created_by,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
};
exports.CacheKeyDAO = {
    async create(data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await runQuery(`
      INSERT INTO cache_keys (
        id, batch_id, cache_key, cache_type, ttl, status, data_source_id,
        data_query, assigned_node_id, retry_count, max_retries, started_at,
        completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id, data.batchId, data.cacheKey, data.cacheType, data.ttl || null, data.status,
            data.dataSourceId, data.dataQuery, data.assignedNodeId || null, data.retryCount,
            data.maxRetries, data.startedAt?.toISOString() || null,
            data.completedAt?.toISOString() || null, now, now
        ]);
        return this.getById(id);
    },
    async bulkCreate(data) {
        const results = [];
        for (const item of data) {
            results.push(await this.create(item));
        }
        return results;
    },
    async getById(id) {
        const row = await getOne(`
      SELECT * FROM cache_keys WHERE id = ?
    `, [id]);
        if (!row)
            return null;
        return this.mapRow(row);
    },
    async getByBatchId(batchId) {
        const rows = await getAll(`
      SELECT * FROM cache_keys WHERE batch_id = ? ORDER BY created_at
    `, [batchId]);
        return rows.map(row => this.mapRow(row));
    },
    async getByBatchIdAndStatus(batchId, status) {
        const rows = await getAll(`
      SELECT * FROM cache_keys WHERE batch_id = ? AND status = ? ORDER BY created_at
    `, [batchId, status]);
        return rows.map(row => this.mapRow(row));
    },
    async updateStatus(id, status, errorMessage) {
        const now = new Date().toISOString();
        if (status === types_1.KeyStatus.SUCCESS || status === types_1.KeyStatus.FAILED || status === types_1.KeyStatus.SKIPPED) {
            await runQuery(`
        UPDATE cache_keys SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
      `, [status, now, now, id]);
        }
        else if (status === types_1.KeyStatus.PROCESSING) {
            await runQuery(`
        UPDATE cache_keys SET status = ?, started_at = ?, updated_at = ? WHERE id = ?
      `, [status, now, now, id]);
        }
        else {
            await runQuery(`
        UPDATE cache_keys SET status = ?, updated_at = ? WHERE id = ?
      `, [status, now, id]);
        }
    },
    async incrementRetry(id) {
        const now = new Date().toISOString();
        await runQuery(`
      UPDATE cache_keys SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?
    `, [now, id]);
    },
    mapRow(row) {
        return {
            id: row.id,
            batchId: row.batch_id,
            cacheKey: row.cache_key,
            cacheType: row.cache_type,
            ttl: row.ttl,
            status: row.status,
            dataSourceId: row.data_source_id,
            dataQuery: row.data_query,
            assignedNodeId: row.assigned_node_id,
            retryCount: row.retry_count,
            maxRetries: row.max_retries,
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
};
exports.FailureRecordDAO = {
    async create(data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await runQuery(`
      INSERT INTO failure_records (
        id, cache_key_id, batch_id, original_input, processing_basis,
        error_message, error_stack, final_conclusion, node_id, occurred_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id, data.cacheKeyId, data.batchId, data.originalInput, data.processingBasis,
            data.errorMessage, data.errorStack || null, data.finalConclusion,
            data.nodeId || null, data.occurredAt.toISOString(), now
        ]);
        return this.getById(id);
    },
    async getById(id) {
        const row = await getOne(`
      SELECT * FROM failure_records WHERE id = ?
    `, [id]);
        if (!row)
            return null;
        return this.mapRow(row);
    },
    async getByBatchId(batchId) {
        const rows = await getAll(`
      SELECT * FROM failure_records WHERE batch_id = ? ORDER BY occurred_at DESC
    `, [batchId]);
        return rows.map(row => this.mapRow(row));
    },
    async getByCacheKeyId(cacheKeyId) {
        const rows = await getAll(`
      SELECT * FROM failure_records WHERE cache_key_id = ? ORDER BY occurred_at DESC
    `, [cacheKeyId]);
        return rows.map(row => this.mapRow(row));
    },
    mapRow(row) {
        return {
            id: row.id,
            cacheKeyId: row.cache_key_id,
            batchId: row.batch_id,
            originalInput: row.original_input,
            processingBasis: row.processing_basis,
            errorMessage: row.error_message,
            errorStack: row.error_stack,
            finalConclusion: row.final_conclusion,
            nodeId: row.node_id,
            occurredAt: new Date(row.occurred_at),
            createdAt: new Date(row.created_at)
        };
    }
};
exports.RetryRecordDAO = {
    async create(data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await runQuery(`
      INSERT INTO retry_records (
        id, cache_key_id, batch_id, retry_attempt, status, node_id,
        started_at, completed_at, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id, data.cacheKeyId, data.batchId, data.retryAttempt, data.status,
            data.nodeId || null, data.startedAt?.toISOString() || null,
            data.completedAt?.toISOString() || null, data.errorMessage || null,
            now, now
        ]);
        return this.getById(id);
    },
    async getById(id) {
        const row = await getOne(`
      SELECT * FROM retry_records WHERE id = ?
    `, [id]);
        if (!row)
            return null;
        return this.mapRow(row);
    },
    async getByCacheKeyId(cacheKeyId) {
        const rows = await getAll(`
      SELECT * FROM retry_records WHERE cache_key_id = ? ORDER BY retry_attempt DESC
    `, [cacheKeyId]);
        return rows.map(row => this.mapRow(row));
    },
    async updateStatus(id, status, errorMessage) {
        const now = new Date().toISOString();
        if (status === types_1.RetryStatus.SUCCESS || status === types_1.RetryStatus.FAILED) {
            await runQuery(`
        UPDATE retry_records SET status = ?, completed_at = ?, error_message = ?, updated_at = ? 
        WHERE id = ?
      `, [status, now, errorMessage || null, now, id]);
        }
        else if (status === types_1.RetryStatus.RUNNING) {
            await runQuery(`
        UPDATE retry_records SET status = ?, started_at = ?, updated_at = ? WHERE id = ?
      `, [status, now, now, id]);
        }
    },
    mapRow(row) {
        return {
            id: row.id,
            cacheKeyId: row.cache_key_id,
            batchId: row.batch_id,
            retryAttempt: row.retry_attempt,
            status: row.status,
            nodeId: row.node_id,
            startedAt: row.started_at ? new Date(row.started_at) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            errorMessage: row.error_message,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
};
exports.DataSourceDAO = {
    async create(data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await runQuery(`
      INSERT INTO data_sources (id, name, type, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, data.name, data.type, JSON.stringify(data.config), now, now]);
        return this.getById(id);
    },
    async getById(id) {
        const row = await getOne(`
      SELECT * FROM data_sources WHERE id = ?
    `, [id]);
        if (!row)
            return null;
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            config: JSON.parse(row.config),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    },
    async list() {
        const rows = await getAll(`SELECT * FROM data_sources ORDER BY created_at DESC`);
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type,
            config: JSON.parse(row.config),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        }));
    }
};
exports.ExecutionNodeDAO = {
    async create(data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await runQuery(`
      INSERT INTO execution_nodes (
        id, name, ip, status, current_batch_id, last_heartbeat, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id, data.name, data.ip, data.status, data.currentBatchId || null,
            data.lastHeartbeat.toISOString(), now, now
        ]);
        return this.getById(id);
    },
    async getById(id) {
        const row = await getOne(`
      SELECT * FROM execution_nodes WHERE id = ?
    `, [id]);
        if (!row)
            return null;
        return this.mapRow(row);
    },
    async list() {
        const rows = await getAll(`SELECT * FROM execution_nodes ORDER BY created_at DESC`);
        return rows.map(row => this.mapRow(row));
    },
    async updateHeartbeat(id) {
        const now = new Date().toISOString();
        await runQuery(`
      UPDATE execution_nodes SET last_heartbeat = ?, updated_at = ? WHERE id = ?
    `, [now, now, id]);
    },
    async updateStatus(id, status) {
        const now = new Date().toISOString();
        await runQuery(`
      UPDATE execution_nodes SET status = ?, updated_at = ? WHERE id = ?
    `, [status, now, id]);
    },
    mapRow(row) {
        return {
            id: row.id,
            name: row.name,
            ip: row.ip,
            status: row.status,
            currentBatchId: row.current_batch_id,
            lastHeartbeat: new Date(row.last_heartbeat),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
};
