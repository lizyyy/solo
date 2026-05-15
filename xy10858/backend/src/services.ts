import db from './database';
import { v4 as uuidv4 } from 'uuid';
import type {
  SynonymGroup,
  SynonymVersion,
  PublishBatch,
  BatchItem,
  TestQuery,
  HitChange,
  RollbackAudit,
  StatusHistory,
  SynonymStatus,
  BatchStatus
} from './types';

const CURRENT_USER = 'admin';

function formatSynonymGroup(row: any): SynonymGroup {
  return {
    ...row,
    synonyms: JSON.parse(row.synonyms)
  };
}

function formatSynonymVersion(row: any): SynonymVersion {
  return {
    ...row,
    synonyms: JSON.parse(row.synonyms)
  };
}

function now(): number {
  return Date.now();
}

function addStatusHistory(
  entityType: 'synonym_group' | 'publish_batch',
  entityId: string,
  fromStatus: string | undefined,
  toStatus: string,
  reason?: string
) {
  const stmt = db.prepare(`
    INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, reason, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(uuidv4(), entityType, entityId, fromStatus, toStatus, reason || null, now(), CURRENT_USER);
}

export function getSynonymGroups(): SynonymGroup[] {
  const rows = db.prepare('SELECT * FROM synonym_groups ORDER BY created_at DESC').all();
  return rows.map(formatSynonymGroup);
}

export function getSynonymGroupById(id: string): SynonymGroup | undefined {
  const row = db.prepare('SELECT * FROM synonym_groups WHERE id = ?').get(id);
  return row ? formatSynonymGroup(row) : undefined;
}

export function createSynonymGroup(data: {
  name: string;
  synonyms: string[];
  application_scope: string;
  description?: string;
}): SynonymGroup {
  const id = uuidv4();
  const timestamp = now();
  
  const existing = db.prepare('SELECT * FROM synonym_groups WHERE name = ?').get(data.name);
  if (existing) {
    throw new Error('同义词组名称已存在');
  }

  const stmt = db.prepare(`
    INSERT INTO synonym_groups (id, name, synonyms, application_scope, status, created_at, updated_at, created_by, version, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  stmt.run(
    id,
    data.name,
    JSON.stringify(data.synonyms),
    data.application_scope,
    'draft',
    timestamp,
    timestamp,
    CURRENT_USER,
    data.description || null
  );

  addStatusHistory('synonym_group', id, undefined, 'draft', '创建草稿');
  saveSynonymVersion(id, 1, data.synonyms, data.application_scope, data.description);

  return getSynonymGroupById(id)!;
}

function saveSynonymVersion(
  groupId: string,
  version: number,
  synonyms: string[],
  applicationScope: string,
  description?: string
) {
  const stmt = db.prepare(`
    INSERT INTO synonym_versions (id, group_id, version, synonyms, application_scope, created_at, created_by, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    uuidv4(),
    groupId,
    version,
    JSON.stringify(synonyms),
    applicationScope,
    now(),
    CURRENT_USER,
    description || null
  );
}

export function updateSynonymGroup(
  id: string,
  data: {
    name?: string;
    synonyms?: string[];
    application_scope?: string;
    description?: string;
  }
): SynonymGroup {
  const group = getSynonymGroupById(id);
  if (!group) {
    throw new Error('同义词组不存在');
  }

  if (group.status === 'published') {
    throw new Error('已发布的同义词组不能直接修改，请创建新版本');
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.synonyms !== undefined) {
    updates.push('synonyms = ?');
    params.push(JSON.stringify(data.synonyms));
  }
  if (data.application_scope !== undefined) {
    updates.push('application_scope = ?');
    params.push(data.application_scope);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }

  if (updates.length === 0) {
    return group;
  }

  updates.push('updated_at = ?');
  params.push(now());
  params.push(id);

  const stmt = db.prepare(`UPDATE synonym_groups SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...params);

  return getSynonymGroupById(id)!;
}

export function updateSynonymGroupStatus(id: string, newStatus: SynonymStatus, reason?: string): SynonymGroup {
  const group = getSynonymGroupById(id);
  if (!group) {
    throw new Error('同义词组不存在');
  }

  const validTransitions: Record<SynonymStatus, SynonymStatus[]> = {
    draft: ['pending_review'],
    pending_review: ['approved', 'rejected', 'draft'],
    approved: ['published'],
    published: ['rollbacked'],
    rejected: ['draft'],
    rollbacked: ['draft']
  };

  if (!validTransitions[group.status]?.includes(newStatus)) {
    throw new Error(`不能从 ${group.status} 状态转换到 ${newStatus} 状态`);
  }

  db.prepare('UPDATE synonym_groups SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now(), id);
  addStatusHistory('synonym_group', id, group.status, newStatus, reason);

  return getSynonymGroupById(id)!;
}

export function getSynonymVersions(groupId: string): SynonymVersion[] {
  const rows = db.prepare('SELECT * FROM synonym_versions WHERE group_id = ? ORDER BY version DESC').all(groupId);
  return rows.map(formatSynonymVersion);
}

export function getStatusHistory(entityType: 'synonym_group' | 'publish_batch', entityId: string): StatusHistory[] {
  return db.prepare('SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC').all(entityType, entityId);
}

export function getPublishBatches(): PublishBatch[] {
  return db.prepare('SELECT * FROM publish_batches ORDER BY created_at DESC').all();
}

export function getPublishBatchById(id: string): PublishBatch | undefined {
  return db.prepare('SELECT * FROM publish_batches WHERE id = ?').get(id);
}

export function createPublishBatch(data: {
  name: string;
  groupIds: string[];
  description?: string;
}): PublishBatch {
  const id = uuidv4();
  const timestamp = now();

  const batchStmt = db.prepare(`
    INSERT INTO publish_batches (id, name, status, created_at, updated_at, created_by, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  batchStmt.run(id, data.name, 'pending', timestamp, timestamp, CURRENT_USER, data.description || null);

  for (const groupId of data.groupIds) {
    const group = getSynonymGroupById(groupId);
    if (!group) {
      throw new Error(`同义词组 ${groupId} 不存在`);
    }
    if (group.status !== 'approved') {
      throw new Error(`同义词组 ${group.name} 状态为 ${group.status}，需要先审批通过才能加入发布批次`);
    }

    const itemStmt = db.prepare(`
      INSERT INTO batch_items (id, batch_id, group_id, version, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    itemStmt.run(uuidv4(), id, groupId, group.version, 'pending');
  }

  addStatusHistory('publish_batch', id, undefined, 'pending', '创建发布批次');
  return getPublishBatchById(id)!;
}

export function getBatchItems(batchId: string): (BatchItem & { group_name: string })[] {
  return db.prepare(`
    SELECT bi.*, sg.name as group_name
    FROM batch_items bi
    JOIN synonym_groups sg ON bi.group_id = sg.id
    WHERE bi.batch_id = ?
  `).all(batchId);
}

export function updateBatchStatus(id: string, newStatus: BatchStatus, reason?: string): PublishBatch {
  const batch = getPublishBatchById(id);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  const validTransitions: Record<BatchStatus, BatchStatus[]> = {
    pending: ['reviewing'],
    reviewing: ['approved', 'pending'],
    approved: ['publishing'],
    publishing: ['published', 'failed'],
    published: ['rollbacking'],
    failed: ['pending'],
    rollbacking: ['rollbacked'],
    rollbacked: ['pending']
  };

  if (!validTransitions[batch.status]?.includes(newStatus)) {
    throw new Error(`不能从 ${batch.status} 状态转换到 ${newStatus} 状态`);
  }

  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const params: any[] = [newStatus, now()];

  if (newStatus === 'approved') {
    updates.push('approved_by = ?', 'approved_at = ?');
    params.push(CURRENT_USER, now());
  } else if (newStatus === 'published') {
    updates.push('published_at = ?');
    params.push(now());
  } else if (newStatus === 'rollbacked') {
    updates.push('rollbacked_by = ?', 'rollbacked_at = ?');
    params.push(CURRENT_USER, now());
  }

  params.push(id);
  db.prepare(`UPDATE publish_batches SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  addStatusHistory('publish_batch', id, batch.status, newStatus, reason);

  return getPublishBatchById(id)!;
}

export function simulatePublish(id: string): { success: boolean; changes: HitChange[]; errors?: string[] } {
  const batch = getPublishBatchById(id);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  const items = getBatchItems(id);
  const changes: HitChange[] = [];
  const errors: string[] = [];

  for (const item of items) {
    const group = getSynonymGroupById(item.group_id);
    if (!group) {
      errors.push(`同义词组 ${item.group_id} 不存在`);
      continue;
    }

    const testQueries = getTestQueries(item.group_id);
    for (const query of testQueries) {
      const hitsBefore = query.actual_hits_before || Math.floor(Math.random() * 100) + 10;
      const hitsAfter = Math.floor(hitsBefore * (0.8 + Math.random() * 0.5));
      const changePercent = ((hitsAfter - hitsBefore) / hitsBefore) * 100;

      if (changePercent < -30) {
        errors.push(`查询 "${query.query}" 命中数下降 ${changePercent.toFixed(1)}%，超过阈值`);
      }

      changes.push({
        id: uuidv4(),
        batch_id: id,
        group_id: item.group_id,
        query: query.query,
        hits_before: hitsBefore,
        hits_after: hitsAfter,
        change_percent: changePercent,
        created_at: now()
      });
    }
  }

  return {
    success: errors.length === 0,
    changes,
    errors: errors.length > 0 ? errors : undefined
  };
}

export function executePublish(id: string): PublishBatch {
  const batch = getPublishBatchById(id);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  if (batch.status !== 'approved') {
    throw new Error('批次状态必须是已审批才能发布');
  }

  updateBatchStatus(id, 'publishing', '开始发布');

  const simulation = simulatePublish(id);

  if (!simulation.success) {
    db.prepare('UPDATE publish_batches SET status = ?, error_message = ?, updated_at = ? WHERE id = ?').run(
      'failed',
      simulation.errors?.join('; '),
      now(),
      id
    );
    addStatusHistory('publish_batch', id, 'publishing', 'failed', simulation.errors?.join('; '));
    return getPublishBatchById(id)!;
  }

  const items = getBatchItems(id);
  for (const item of items) {
    db.prepare('UPDATE synonym_groups SET status = ?, updated_at = ? WHERE id = ?').run('published', now(), item.group_id);
    addStatusHistory('synonym_group', item.group_id, 'approved', 'published', `通过批次 ${batch.name} 发布`);

    for (const change of simulation.changes) {
      if (change.group_id === item.group_id) {
        const stmt = db.prepare(`
          INSERT INTO hit_changes (id, batch_id, group_id, query, hits_before, hits_after, change_percent, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(change.id, change.batch_id, change.group_id, change.query, change.hits_before, change.hits_after, change.change_percent, change.created_at);
      }
    }
  }

  return updateBatchStatus(id, 'published', '发布成功');
}

export function rollbackBatch(id: string, reason: string): PublishBatch {
  const batch = getPublishBatchById(id);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  if (batch.status !== 'published') {
    throw new Error('只有已发布的批次才能回滚');
  }

  updateBatchStatus(id, 'rollbacking', '开始回滚');

  const items = getBatchItems(id);
  for (const item of items) {
    const versions = getSynonymVersions(item.group_id);
    if (versions.length >= 2) {
      const prevVersion = versions[1];
      db.prepare(`
        UPDATE synonym_groups
        SET synonyms = ?, application_scope = ?, version = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(prevVersion.synonyms),
        prevVersion.application_scope,
        prevVersion.version,
        'rollbacked',
        now(),
        item.group_id
      );

      const auditStmt = db.prepare(`
        INSERT INTO rollback_audits (id, batch_id, group_id, rollback_from_version, rollback_to_version, reason, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      auditStmt.run(uuidv4(), id, item.group_id, item.version, prevVersion.version, reason, now(), CURRENT_USER);

      addStatusHistory('synonym_group', item.group_id, 'published', 'rollbacked', reason);
    }
  }

  return updateBatchStatus(id, 'rollbacked', reason);
}

export function getTestQueries(groupId: string): TestQuery[] {
  return db.prepare('SELECT * FROM test_queries WHERE group_id = ? ORDER BY created_at DESC').all(groupId);
}

export function addTestQuery(groupId: string, query: string, expectedHits?: number): TestQuery {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO test_queries (id, group_id, query, expected_hits, actual_hits_before, actual_hits_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, groupId, query, expectedHits || null, Math.floor(Math.random() * 100) + 10, null, now());
  return db.prepare('SELECT * FROM test_queries WHERE id = ?').get(id);
}

export function getHitChanges(batchId: string): HitChange[] {
  return db.prepare('SELECT * FROM hit_changes WHERE batch_id = ? ORDER BY created_at DESC').all(batchId);
}

export function getRollbackAudits(batchId: string): RollbackAudit[] {
  return db.prepare('SELECT * FROM rollback_audits WHERE batch_id = ? ORDER BY created_at DESC').all(batchId);
}

export function exportBatchData(batchId: string): any[] {
  const batch = getPublishBatchById(batchId);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  const items = getBatchItems(batchId);
  const changes = getHitChanges(batchId);
  const audits = getRollbackAudits(batchId);
  const history = getStatusHistory('publish_batch', batchId);

  return items.map(item => {
    const group = getSynonymGroupById(item.group_id);
    const itemChanges = changes.filter(c => c.group_id === item.group_id);
    const itemAudits = audits.filter(a => a.group_id === item.group_id);
    const itemHistory = getStatusHistory('synonym_group', item.group_id);

    return {
      batch_id: batchId,
      batch_name: batch.name,
      batch_status: batch.status,
      group_id: item.group_id,
      group_name: group?.name || item.group_name,
      group_version: item.version,
      group_status: group?.status || item.status,
      application_scope: group?.application_scope || '',
      synonyms: group?.synonyms.join(', ') || '',
      hit_changes_count: itemChanges.length,
      hit_change_avg_percent: itemChanges.length > 0 
        ? (itemChanges.reduce((sum, c) => sum + c.change_percent, 0) / itemChanges.length).toFixed(2)
        : '0',
      rollback_count: itemAudits.length,
      last_status_change: itemHistory.length > 0 ? itemHistory[0].to_status : '',
      last_status_reason: itemHistory.length > 0 ? itemHistory[0].reason || '' : '',
      status_explanation: generateStatusExplanation(batch, group, itemHistory)
    };
  });
}

function generateStatusExplanation(batch: PublishBatch, group?: SynonymGroup, history?: StatusHistory[]): string {
  const explanations: string[] = [];

  if (batch.error_message) {
    explanations.push(`发布失败: ${batch.error_message}`);
  }

  if (history && history.length > 0) {
    const last = history[0];
    if (last.reason) {
      explanations.push(`最后操作: ${last.reason}`);
    }
  }

  if (group?.status === 'published') {
    explanations.push('同义词已生效');
  } else if (group?.status === 'rollbacked') {
    explanations.push('已回滚到上一版本');
  } else if (group?.status === 'rejected') {
    explanations.push('审批被驳回，需要修改');
  }

  return explanations.length > 0 ? explanations.join('; ') : '正常流程中';
}
