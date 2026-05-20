import { run, get, all } from './database';
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

async function addStatusHistory(
  entityType: 'synonym_group' | 'publish_batch',
  entityId: string,
  fromStatus: string | undefined,
  toStatus: string,
  reason?: string
): Promise<void> {
  await run(
    'INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, reason, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), entityType, entityId, fromStatus || null, toStatus, reason || null, now(), CURRENT_USER]
  );
}

export async function getSynonymGroups(): Promise<SynonymGroup[]> {
  const rows = await all('SELECT * FROM synonym_groups ORDER BY created_at DESC');
  return rows.map(formatSynonymGroup);
}

export async function getSynonymGroupById(id: string): Promise<SynonymGroup | undefined> {
  const row = await get('SELECT * FROM synonym_groups WHERE id = ?', [id]);
  return row ? formatSynonymGroup(row) : undefined;
}

export async function createSynonymGroup(data: {
  name: string;
  synonyms: string[];
  application_scope: string;
  description?: string;
}): Promise<SynonymGroup> {
  const id = uuidv4();
  const timestamp = now();

  const existing = await get('SELECT * FROM synonym_groups WHERE name = ?', [data.name]);
  if (existing) {
    throw new Error('同义词组名称已存在');
  }

  await run(
    'INSERT INTO synonym_groups (id, name, synonyms, application_scope, status, created_at, updated_at, created_by, version, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
    [id, data.name, JSON.stringify(data.synonyms), data.application_scope, 'draft', timestamp, timestamp, CURRENT_USER, data.description || null]
  );

  await addStatusHistory('synonym_group', id, undefined, 'draft', '创建草稿');
  await saveSynonymVersion(id, 1, data.synonyms, data.application_scope, data.description);

  return getSynonymGroupById(id) as Promise<SynonymGroup>;
}

async function saveSynonymVersion(
  groupId: string,
  version: number,
  synonyms: string[],
  applicationScope: string,
  description?: string
): Promise<void> {
  await run(
    'INSERT INTO synonym_versions (id, group_id, version, synonyms, application_scope, created_at, created_by, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), groupId, version, JSON.stringify(synonyms), applicationScope, now(), CURRENT_USER, description || null]
  );
}

export async function updateSynonymGroup(
  id: string,
  data: {
    name?: string;
    synonyms?: string[];
    application_scope?: string;
    description?: string;
    createNewVersion?: boolean;
  }
): Promise<SynonymGroup> {
  const group = await getSynonymGroupById(id);
  if (!group) {
    throw new Error('同义词组不存在');
  }

  if (group.status === 'published' && !data.createNewVersion) {
    throw new Error('已发布的同义词组需要创建新版本才能修改');
  }

  const updates: string[] = [];
  const params: any[] = [];
  let newSynonyms = group.synonyms;
  let newScope = group.application_scope;
  let newDescription = group.description;

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.synonyms !== undefined) {
    updates.push('synonyms = ?');
    params.push(JSON.stringify(data.synonyms));
    newSynonyms = data.synonyms;
  }
  if (data.application_scope !== undefined) {
    updates.push('application_scope = ?');
    params.push(data.application_scope);
    newScope = data.application_scope;
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
    newDescription = data.description;
  }

  if (updates.length === 0) {
    return group;
  }

  const newVersion = group.version + 1;
  updates.push('version = ?');
  params.push(newVersion);
  updates.push('updated_at = ?');
  params.push(now());
  params.push(id);

  await run(`UPDATE synonym_groups SET ${updates.join(', ')} WHERE id = ?`, params);

  await saveSynonymVersion(id, newVersion, newSynonyms, newScope, newDescription);

  return getSynonymGroupById(id) as Promise<SynonymGroup>;
}

export async function updateSynonymGroupStatus(id: string, newStatus: SynonymStatus, reason?: string): Promise<SynonymGroup> {
  const group = await getSynonymGroupById(id);
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

  await run('UPDATE synonym_groups SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now(), id]);
  await addStatusHistory('synonym_group', id, group.status, newStatus, reason);

  return getSynonymGroupById(id) as Promise<SynonymGroup>;
}

export async function getSynonymVersions(groupId: string): Promise<SynonymVersion[]> {
  const rows = await all('SELECT * FROM synonym_versions WHERE group_id = ? ORDER BY version DESC', [groupId]);
  return rows.map(formatSynonymVersion);
}

export async function getStatusHistory(entityType: 'synonym_group' | 'publish_batch', entityId: string): Promise<StatusHistory[]> {
  return await all('SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC', [entityType, entityId]);
}

export async function getPublishBatches(): Promise<PublishBatch[]> {
  return await all('SELECT * FROM publish_batches ORDER BY created_at DESC');
}

export async function getPublishBatchById(id: string): Promise<PublishBatch | undefined> {
  return await get('SELECT * FROM publish_batches WHERE id = ?', [id]);
}

export async function createPublishBatch(data: {
  name: string;
  groupIds: string[];
  description?: string;
}): Promise<PublishBatch> {
  const id = uuidv4();
  const timestamp = now();

  await run(
    'INSERT INTO publish_batches (id, name, status, created_at, updated_at, created_by, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, data.name, 'pending', timestamp, timestamp, CURRENT_USER, data.description || null]
  );

  for (const groupId of data.groupIds) {
    const group = await getSynonymGroupById(groupId);
    if (!group) {
      throw new Error(`同义词组 ${groupId} 不存在`);
    }
    if (group.status !== 'approved') {
      throw new Error(`同义词组 ${group.name} 状态为 ${group.status}，需要先审批通过才能加入发布批次`);
    }

    await run(
      'INSERT INTO batch_items (id, batch_id, group_id, version, status) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), id, groupId, group.version, 'pending']
    );
  }

  await addStatusHistory('publish_batch', id, undefined, 'pending', '创建发布批次');
  return getPublishBatchById(id) as Promise<PublishBatch>;
}

export async function getBatchItems(batchId: string): Promise<(BatchItem & { group_name: string })[]> {
  return await all(`
    SELECT bi.*, sg.name as group_name
    FROM batch_items bi
    JOIN synonym_groups sg ON bi.group_id = sg.id
    WHERE bi.batch_id = ?
  `, [batchId]);
}

export async function updateBatchStatus(id: string, newStatus: BatchStatus, reason?: string): Promise<PublishBatch> {
  const batch = await getPublishBatchById(id);
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
  await run(`UPDATE publish_batches SET ${updates.join(', ')} WHERE id = ?`, params);
  await addStatusHistory('publish_batch', id, batch.status, newStatus, reason);

  return getPublishBatchById(id) as Promise<PublishBatch>;
}

export async function simulatePublish(id: string): Promise<{ success: boolean; changes: HitChange[]; errors?: string[] }> {
  const batch = await getPublishBatchById(id);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  const items = await getBatchItems(id);
  const changes: HitChange[] = [];
  const errors: string[] = [];
  const INTERCEPT_THRESHOLD = -15;

  let forceMode: 'normal' | 'intercept' | 'random' = 'random';
  if (batch.name.includes('正常') || batch.name.includes('第一季度') || batch.name.includes('第二季度') || batch.name.includes('回滚')) {
    forceMode = 'normal';
  } else if (batch.name.includes('拦截') || batch.name.includes('第三季度')) {
    forceMode = 'intercept';
  }

  for (const item of items) {
    const group = await getSynonymGroupById(item.group_id);
    if (!group) {
      errors.push(`同义词组 ${item.group_id} 不存在`);
      continue;
    }

    const testQueries = await getTestQueries(item.group_id);
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      const hitsBefore = query.actual_hits_before || 50 + i * 10;
      
      let multiplier: number;
      if (forceMode === 'normal') {
        multiplier = 0.95 + i * 0.05;
      } else if (forceMode === 'intercept') {
        multiplier = i === 0 ? 0.7 : 0.85;
      } else {
        multiplier = 0.85 + Math.random() * 0.3;
      }
      
      const hitsAfter = Math.floor(hitsBefore * multiplier);
      const changePercent = ((hitsAfter - hitsBefore) / hitsBefore) * 100;

      if (changePercent < INTERCEPT_THRESHOLD) {
        errors.push(`查询 "${query.query}" 命中数下降 ${changePercent.toFixed(1)}%，超过阈值 ${INTERCEPT_THRESHOLD}%`);
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

export async function executePublish(id: string): Promise<PublishBatch> {
  const batch = await getPublishBatchById(id);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  if (batch.status !== 'approved') {
    throw new Error('批次状态必须是已审批才能发布');
  }

  await updateBatchStatus(id, 'publishing', '开始发布');

  const simulation = await simulatePublish(id);

  if (!simulation.success) {
    await run('UPDATE publish_batches SET status = ?, error_message = ?, updated_at = ? WHERE id = ?', [
      'failed',
      simulation.errors?.join('; '),
      now(),
      id
    ]);
    await addStatusHistory('publish_batch', id, 'publishing', 'failed', simulation.errors?.join('; '));
    return getPublishBatchById(id) as Promise<PublishBatch>;
  }

  const items = await getBatchItems(id);
  for (const item of items) {
    await run('UPDATE synonym_groups SET status = ?, updated_at = ? WHERE id = ?', ['published', now(), item.group_id]);
    await addStatusHistory('synonym_group', item.group_id, 'approved', 'published', `通过批次 ${batch.name} 发布`);

    for (const change of simulation.changes) {
      if (change.group_id === item.group_id) {
        await run(
          'INSERT INTO hit_changes (id, batch_id, group_id, query, hits_before, hits_after, change_percent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [change.id, change.batch_id, change.group_id, change.query, change.hits_before, change.hits_after, change.change_percent, change.created_at]
        );
      }
    }
  }

  return updateBatchStatus(id, 'published', '发布成功');
}

export async function rollbackBatch(id: string, reason: string): Promise<PublishBatch> {
  const batch = await getPublishBatchById(id);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  if (batch.status !== 'published') {
    throw new Error('只有已发布的批次才能回滚');
  }

  await updateBatchStatus(id, 'rollbacking', '开始回滚');

  const items = await getBatchItems(id);
  for (const item of items) {
    const versions = await getSynonymVersions(item.group_id);
    const group = await getSynonymGroupById(item.group_id);
    let rollbackToVersion = item.version;

    if (versions.length >= 2) {
      const prevVersion = versions[1];
      rollbackToVersion = prevVersion.version;
      await run(
        'UPDATE synonym_groups SET synonyms = ?, application_scope = ?, version = ?, status = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(prevVersion.synonyms), prevVersion.application_scope, prevVersion.version, 'rollbacked', now(), item.group_id]
      );
    } else {
      await run(
        'UPDATE synonym_groups SET status = ?, updated_at = ? WHERE id = ?',
        ['rollbacked', now(), item.group_id]
      );
    }

    await run(
      'INSERT INTO rollback_audits (id, batch_id, group_id, rollback_from_version, rollback_to_version, reason, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, item.group_id, item.version, rollbackToVersion, reason, now(), CURRENT_USER]
    );

    await addStatusHistory('synonym_group', item.group_id, 'published', 'rollbacked', reason);
  }

  return updateBatchStatus(id, 'rollbacked', reason);
}

export async function getTestQueries(groupId: string): Promise<TestQuery[]> {
  return await all('SELECT * FROM test_queries WHERE group_id = ? ORDER BY created_at DESC', [groupId]);
}

export async function addTestQuery(groupId: string, query: string, expectedHits?: number): Promise<TestQuery> {
  const id = uuidv4();
  await run(
    'INSERT INTO test_queries (id, group_id, query, expected_hits, actual_hits_before, actual_hits_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, groupId, query, expectedHits || null, Math.floor(Math.random() * 100) + 10, null, now()]
  );
  return await get('SELECT * FROM test_queries WHERE id = ?', [id]) as Promise<TestQuery>;
}

export async function getHitChanges(batchId: string): Promise<HitChange[]> {
  return await all('SELECT * FROM hit_changes WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
}

export async function getRollbackAudits(batchId: string): Promise<RollbackAudit[]> {
  return await all('SELECT * FROM rollback_audits WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
}

export async function exportBatchData(batchId: string): Promise<any[]> {
  const batch = await getPublishBatchById(batchId);
  if (!batch) {
    throw new Error('发布批次不存在');
  }

  const items = await getBatchItems(batchId);
  const changes = await getHitChanges(batchId);
  const audits = await getRollbackAudits(batchId);
  const history = await getStatusHistory('publish_batch', batchId);

  const result = [];
  for (const item of items) {
    const group = await getSynonymGroupById(item.group_id);
    const itemChanges = changes.filter(c => c.group_id === item.group_id);
    const itemAudits = audits.filter(a => a.group_id === item.group_id);
    const itemHistory = await getStatusHistory('synonym_group', item.group_id);

    result.push({
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
      last_status: itemHistory.length > 0 ? itemHistory[0].to_status : '',
      last_status_reason: itemHistory.length > 0 ? itemHistory[0].reason || '' : '',
      status_explanation: generateStatusExplanation(batch, group, itemHistory)
    });
  }

  return result;
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
