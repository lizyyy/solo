import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './init';
import {
  WarmupBatch,
  CacheKey,
  FailureRecord,
  RetryRecord,
  DataSource,
  ExecutionNode,
  BatchStatus,
  KeyStatus,
  RetryStatus,
  NodeStatus
} from '../models/types';

const db = getDatabase();

const runQuery = (sql: string, params: any[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const getOne = <T>(sql: string, params: any[] = []): Promise<T | null> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T || null);
    });
  });
};

const getAll = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

export const BatchDAO = {
  async create(data: Omit<WarmupBatch, 'id' | 'createdAt' | 'updatedAt'>): Promise<WarmupBatch> {
    const id = uuidv4();
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
    return this.getById(id) as Promise<WarmupBatch>;
  },

  async getById(id: string): Promise<WarmupBatch | null> {
    const row = await getOne<any>(`
      SELECT * FROM warmup_batches WHERE id = ?
    `, [id]);
    if (!row) return null;
    return this.mapRow(row);
  },

  async list(limit: number = 100, offset: number = 0): Promise<WarmupBatch[]> {
    const rows = await getAll<any>(`
      SELECT * FROM warmup_batches ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [limit, offset]);
    return rows.map(row => this.mapRow(row));
  },

  async updateStatus(id: string, status: BatchStatus): Promise<void> {
    const now = new Date().toISOString();
    await runQuery(`
      UPDATE warmup_batches SET status = ?, updated_at = ? WHERE id = ?
    `, [status, now, id]);
  },

  async updateCounts(id: string, successKeys: number, failedKeys: number, pendingKeys: number): Promise<void> {
    const now = new Date().toISOString();
    await runQuery(`
      UPDATE warmup_batches 
      SET success_keys = ?, failed_keys = ?, pending_keys = ?, updated_at = ?
      WHERE id = ?
    `, [successKeys, failedKeys, pendingKeys, now, id]);
  },

  async startBatch(id: string): Promise<void> {
    const now = new Date().toISOString();
    await runQuery(`
      UPDATE warmup_batches SET status = ?, started_at = ?, updated_at = ? WHERE id = ?
    `, [BatchStatus.RUNNING, now, now, id]);
  },

  async completeBatch(id: string, status: BatchStatus): Promise<void> {
    const now = new Date().toISOString();
    await runQuery(`
      UPDATE warmup_batches SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
    `, [status, now, now, id]);
  },

  mapRow(row: any): WarmupBatch {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status as BatchStatus,
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

export const CacheKeyDAO = {
  async create(data: Omit<CacheKey, 'id' | 'createdAt' | 'updatedAt'>): Promise<CacheKey> {
    const id = uuidv4();
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
    return this.getById(id) as Promise<CacheKey>;
  },

  async bulkCreate(data: Array<Omit<CacheKey, 'id' | 'createdAt' | 'updatedAt'>>): Promise<CacheKey[]> {
    const results: CacheKey[] = [];
    for (const item of data) {
      results.push(await this.create(item));
    }
    return results;
  },

  async getById(id: string): Promise<CacheKey | null> {
    const row = await getOne<any>(`
      SELECT * FROM cache_keys WHERE id = ?
    `, [id]);
    if (!row) return null;
    return this.mapRow(row);
  },

  async getByBatchId(batchId: string): Promise<CacheKey[]> {
    const rows = await getAll<any>(`
      SELECT * FROM cache_keys WHERE batch_id = ? ORDER BY created_at
    `, [batchId]);
    return rows.map(row => this.mapRow(row));
  },

  async getByBatchIdAndStatus(batchId: string, status: KeyStatus): Promise<CacheKey[]> {
    const rows = await getAll<any>(`
      SELECT * FROM cache_keys WHERE batch_id = ? AND status = ? ORDER BY created_at
    `, [batchId, status]);
    return rows.map(row => this.mapRow(row));
  },

  async updateStatus(id: string, status: KeyStatus, errorMessage?: string): Promise<void> {
    const now = new Date().toISOString();
    if (status === KeyStatus.SUCCESS || status === KeyStatus.FAILED || status === KeyStatus.SKIPPED) {
      await runQuery(`
        UPDATE cache_keys SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
      `, [status, now, now, id]);
    } else if (status === KeyStatus.PROCESSING) {
      await runQuery(`
        UPDATE cache_keys SET status = ?, started_at = ?, updated_at = ? WHERE id = ?
      `, [status, now, now, id]);
    } else {
      await runQuery(`
        UPDATE cache_keys SET status = ?, updated_at = ? WHERE id = ?
      `, [status, now, id]);
    }
  },

  async incrementRetry(id: string): Promise<void> {
    const now = new Date().toISOString();
    await runQuery(`
      UPDATE cache_keys SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?
    `, [now, id]);
  },

  mapRow(row: any): CacheKey {
    return {
      id: row.id,
      batchId: row.batch_id,
      cacheKey: row.cache_key,
      cacheType: row.cache_type,
      ttl: row.ttl,
      status: row.status as KeyStatus,
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

export const FailureRecordDAO = {
  async create(data: Omit<FailureRecord, 'id' | 'createdAt'>): Promise<FailureRecord> {
    const id = uuidv4();
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
    return this.getById(id) as Promise<FailureRecord>;
  },

  async getById(id: string): Promise<FailureRecord | null> {
    const row = await getOne<any>(`
      SELECT * FROM failure_records WHERE id = ?
    `, [id]);
    if (!row) return null;
    return this.mapRow(row);
  },

  async getByBatchId(batchId: string): Promise<FailureRecord[]> {
    const rows = await getAll<any>(`
      SELECT * FROM failure_records WHERE batch_id = ? ORDER BY occurred_at DESC
    `, [batchId]);
    return rows.map(row => this.mapRow(row));
  },

  async getByCacheKeyId(cacheKeyId: string): Promise<FailureRecord[]> {
    const rows = await getAll<any>(`
      SELECT * FROM failure_records WHERE cache_key_id = ? ORDER BY occurred_at DESC
    `, [cacheKeyId]);
    return rows.map(row => this.mapRow(row));
  },

  mapRow(row: any): FailureRecord {
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

export const RetryRecordDAO = {
  async create(data: Omit<RetryRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<RetryRecord> {
    const id = uuidv4();
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
    return this.getById(id) as Promise<RetryRecord>;
  },

  async getById(id: string): Promise<RetryRecord | null> {
    const row = await getOne<any>(`
      SELECT * FROM retry_records WHERE id = ?
    `, [id]);
    if (!row) return null;
    return this.mapRow(row);
  },

  async getByCacheKeyId(cacheKeyId: string): Promise<RetryRecord[]> {
    const rows = await getAll<any>(`
      SELECT * FROM retry_records WHERE cache_key_id = ? ORDER BY retry_attempt DESC
    `, [cacheKeyId]);
    return rows.map(row => this.mapRow(row));
  },

  async updateStatus(id: string, status: RetryStatus, errorMessage?: string): Promise<void> {
    const now = new Date().toISOString();
    if (status === RetryStatus.SUCCESS || status === RetryStatus.FAILED) {
      await runQuery(`
        UPDATE retry_records SET status = ?, completed_at = ?, error_message = ?, updated_at = ? 
        WHERE id = ?
      `, [status, now, errorMessage || null, now, id]);
    } else if (status === RetryStatus.RUNNING) {
      await runQuery(`
        UPDATE retry_records SET status = ?, started_at = ?, updated_at = ? WHERE id = ?
      `, [status, now, now, id]);
    }
  },

  mapRow(row: any): RetryRecord {
    return {
      id: row.id,
      cacheKeyId: row.cache_key_id,
      batchId: row.batch_id,
      retryAttempt: row.retry_attempt,
      status: row.status as RetryStatus,
      nodeId: row.node_id,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      errorMessage: row.error_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
};

export const DataSourceDAO = {
  async create(data: Omit<DataSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<DataSource> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await runQuery(`
      INSERT INTO data_sources (id, name, type, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, data.name, data.type, JSON.stringify(data.config), now, now]);
    return this.getById(id) as Promise<DataSource>;
  },

  async getById(id: string): Promise<DataSource | null> {
    const row = await getOne<any>(`
      SELECT * FROM data_sources WHERE id = ?
    `, [id]);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      config: JSON.parse(row.config),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  },

  async list(): Promise<DataSource[]> {
    const rows = await getAll<any>(`SELECT * FROM data_sources ORDER BY created_at DESC`);
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

export const ExecutionNodeDAO = {
  async create(data: Omit<ExecutionNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExecutionNode> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await runQuery(`
      INSERT INTO execution_nodes (
        id, name, ip, status, current_batch_id, last_heartbeat, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.name, data.ip, data.status, data.currentBatchId || null,
      data.lastHeartbeat.toISOString(), now, now
    ]);
    return this.getById(id) as Promise<ExecutionNode>;
  },

  async getById(id: string): Promise<ExecutionNode | null> {
    const row = await getOne<any>(`
      SELECT * FROM execution_nodes WHERE id = ?
    `, [id]);
    if (!row) return null;
    return this.mapRow(row);
  },

  async list(): Promise<ExecutionNode[]> {
    const rows = await getAll<any>(`SELECT * FROM execution_nodes ORDER BY created_at DESC`);
    return rows.map(row => this.mapRow(row));
  },

  async updateHeartbeat(id: string): Promise<void> {
    const now = new Date().toISOString();
    await runQuery(`
      UPDATE execution_nodes SET last_heartbeat = ?, updated_at = ? WHERE id = ?
    `, [now, now, id]);
  },

  async updateStatus(id: string, status: NodeStatus): Promise<void> {
    const now = new Date().toISOString();
    await runQuery(`
      UPDATE execution_nodes SET status = ?, updated_at = ? WHERE id = ?
    `, [status, now, id]);
  },

  mapRow(row: any): ExecutionNode {
    return {
      id: row.id,
      name: row.name,
      ip: row.ip,
      status: row.status as NodeStatus,
      currentBatchId: row.current_batch_id,
      lastHeartbeat: new Date(row.last_heartbeat),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
};
