import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from './database';
import {
  BatchStatus,
  NodeStatus,
  ConsumerStatus,
  SyncBatch,
  DepartmentNode,
  ExceptionNode,
  CreateBatchRequest,
  ManualFixRequest,
  ConsumerProgress
} from './types';

export async function createSyncBatch(request: CreateBatchRequest): Promise<SyncBatch> {
  const batchId = uuidv4();
  const now = Date.now();
  const rawInput = JSON.stringify(request.departments);

  const batch: SyncBatch = {
    id: batchId,
    source: request.source,
    totalNodes: request.departments.length,
    validNodes: 0,
    invalidNodes: 0,
    status: BatchStatus.CREATED,
    rawInput,
    createdAt: now,
    updatedAt: now,
    createdBy: request.createdBy
  };

  await run(
    `INSERT INTO sync_batches (
      id, source, total_nodes, valid_nodes, invalid_nodes, status,
      raw_input, created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batchId, request.source, request.departments.length, 0, 0, BatchStatus.CREATED,
      rawInput, now, now, request.createdBy
    ]
  );

  for (const dept of request.departments) {
    const nodeId = uuidv4();
    await run(
      `INSERT INTO department_nodes (
        id, batch_id, dept_id, dept_name, parent_dept_id,
        level, sort_order, status, raw_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeId, batchId, dept.deptId, dept.deptName, dept.parentDeptId,
        0, dept.sortOrder || 0, NodeStatus.PENDING, JSON.stringify(dept), now, now
      ]
    );
  }

  return batch;
}

export async function validateSyncBatch(batchId: string): Promise<{ valid: boolean; report: string }> {
  const batch = await getSyncBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  await run(
    'UPDATE sync_batches SET status = ?, updated_at = ? WHERE id = ?',
    [BatchStatus.VALIDATING, Date.now(), batchId]
  );

  const nodes = await all<any>(
    'SELECT * FROM department_nodes WHERE batch_id = ?',
    [batchId]
  );

  const deptMap = new Map<string, any>();
  const exceptions: ExceptionNode[] = [];
  let validCount = 0;

  for (const node of nodes) {
    deptMap.set(node.dept_id, node);
  }

  const deptIds = new Set<string>();
  const rootNodes: string[] = [];

  for (const node of nodes) {
    if (deptIds.has(node.dept_id)) {
      await createExceptionNode(
        batchId,
        node.id,
        node.dept_id,
        'DUPLICATE_ID',
        `部门ID ${node.dept_id} 重复`,
        node.raw_data,
        '部门ID必须唯一'
      );
      exceptions.push({} as ExceptionNode);
      await updateNodeStatus(node.id, NodeStatus.INVALID);
      continue;
    }
    deptIds.add(node.dept_id);

    if (node.parent_dept_id && !deptMap.has(node.parent_dept_id)) {
      await createExceptionNode(
        batchId,
        node.id,
        node.dept_id,
        'MISSING_PARENT',
        `上级部门 ${node.parent_dept_id} 不存在`,
        node.raw_data,
        '上级部门ID必须在当前批次中存在或为null'
      );
      exceptions.push({} as ExceptionNode);
      await updateNodeStatus(node.id, NodeStatus.INVALID);
      continue;
    }

    if (!node.parent_dept_id) {
      rootNodes.push(node.dept_id);
    }

    validCount++;
    await updateNodeStatus(node.id, NodeStatus.VALID);
  }

  if (rootNodes.length === 0) {
    const report = {
      valid: false,
      error: '没有根节点（parentDeptId为null的部门）',
      validCount: 0,
      invalidCount: nodes.length,
      exceptions: exceptions.length
    };
    await run(
      'UPDATE sync_batches SET status = ?, validation_report = ?, updated_at = ? WHERE id = ?',
      [BatchStatus.VALIDATION_FAILED, JSON.stringify(report), Date.now(), batchId]
    );
    return { valid: false, report: JSON.stringify(report) };
  }

  await calculateDepartmentLevels(batchId, rootNodes, deptMap);
  await buildDepartmentRelations(batchId, deptMap);

  const invalidCount = nodes.length - validCount;
  const report = {
    valid: invalidCount === 0,
    rootCount: rootNodes.length,
    validCount,
    invalidCount,
    exceptionCount: exceptions.length
  };

  const finalStatus = invalidCount > 0 ? BatchStatus.VALIDATION_FAILED : BatchStatus.READY;
  await run(
    `UPDATE sync_batches 
     SET status = ?, valid_nodes = ?, invalid_nodes = ?, validation_report = ?, updated_at = ? 
     WHERE id = ?`,
    [finalStatus, validCount, invalidCount, JSON.stringify(report), Date.now(), batchId]
  );

  return { valid: invalidCount === 0, report: JSON.stringify(report) };
}

async function calculateDepartmentLevels(
  batchId: string,
  rootNodes: string[],
  deptMap: Map<string, DepartmentNode>
): Promise<void> {
  const childrenMap = new Map<string, string[]>();
  for (const [deptId, node] of deptMap) {
    if (node.parentDeptId) {
      if (!childrenMap.has(node.parentDeptId)) {
        childrenMap.set(node.parentDeptId, []);
      }
      childrenMap.get(node.parentDeptId)!.push(deptId);
    }
  }

  const queue: Array<{ deptId: string; level: number }> = rootNodes.map(id => ({ deptId: id, level: 1 }));

  while (queue.length > 0) {
    const { deptId, level } = queue.shift()!;
    await run(
      'UPDATE department_nodes SET level = ?, updated_at = ? WHERE batch_id = ? AND dept_id = ?',
      [level, Date.now(), batchId, deptId]
    );

    const children = childrenMap.get(deptId) || [];
    for (const childId of children) {
      queue.push({ deptId: childId, level: level + 1 });
    }
  }
}

async function buildDepartmentRelations(
  batchId: string,
  deptMap: Map<string, DepartmentNode>
): Promise<void> {
  for (const [deptId, node] of deptMap) {
    const ancestors: string[] = [];
    let current: DepartmentNode | undefined = node;
    let distance = 0;

    while (current) {
      if (distance > 0) {
        ancestors.push(current.deptId);
      }
      current = current.parentDeptId ? deptMap.get(current.parentDeptId) : undefined;
      distance++;
    }

    for (let i = 0; i < ancestors.length; i++) {
      await run(
        `INSERT OR IGNORE INTO department_relations 
         (id, batch_id, ancestor_dept_id, descendant_dept_id, distance, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), batchId, ancestors[i], deptId, i + 1, Date.now()]
      );
    }
  }
}

async function createExceptionNode(
  batchId: string,
  nodeId: string,
  deptId: string,
  errorType: string,
  errorMessage: string,
  rawInput: string,
  processingBasis: string
): Promise<void> {
  await run(
    `INSERT INTO exception_nodes (
      id, batch_id, node_id, dept_id, error_type, error_message,
      raw_input, processing_basis, is_resolved, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [uuidv4(), batchId, nodeId, deptId, errorType, errorMessage, rawInput, processingBasis, Date.now()]
  );
}

async function updateNodeStatus(nodeId: string, status: NodeStatus): Promise<void> {
  await run(
    'UPDATE department_nodes SET status = ?, updated_at = ? WHERE id = ?',
    [status, Date.now(), nodeId]
  );
}

export async function getSyncBatch(batchId: string): Promise<SyncBatch | undefined> {
  const row = await get<any>('SELECT * FROM sync_batches WHERE id = ?', [batchId]);
  if (!row) return undefined;
  return {
    id: row.id,
    source: row.source,
    totalNodes: row.total_nodes,
    validNodes: row.valid_nodes,
    invalidNodes: row.invalid_nodes,
    status: row.status,
    rawInput: row.raw_input,
    validationReport: row.validation_report,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdBy: row.created_by
  };
}

export async function getDepartmentNodes(batchId: string): Promise<DepartmentNode[]> {
  const rows = await all<any>('SELECT * FROM department_nodes WHERE batch_id = ? ORDER BY level, sort_order', [batchId]);
  return rows.map(row => ({
    id: row.id,
    batchId: row.batch_id,
    deptId: row.dept_id,
    deptName: row.dept_name,
    parentDeptId: row.parent_dept_id,
    level: row.level,
    sortOrder: row.sort_order,
    status: row.status,
    rawData: row.raw_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function getExceptionNodes(batchId: string): Promise<ExceptionNode[]> {
  const rows = await all<any>('SELECT * FROM exception_nodes WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
  return rows.map(row => ({
    id: row.id,
    batchId: row.batch_id,
    nodeId: row.node_id,
    deptId: row.dept_id,
    errorType: row.error_type,
    errorMessage: row.error_message,
    rawInput: row.raw_input,
    processingBasis: row.processing_basis,
    resolution: row.resolution,
    isResolved: row.is_resolved === 1 ? true : false,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at
  }));
}

export async function startConsumption(batchId: string): Promise<void> {
  const batch = await getSyncBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }
  if (batch.status !== BatchStatus.READY) {
    throw new Error('Batch not ready for consumption');
  }

  await run(
    'UPDATE sync_batches SET status = ?, started_at = ?, updated_at = ? WHERE id = ?',
    [BatchStatus.CONSUMING, Date.now(), Date.now(), batchId]
  );

  const consumers = await all<{ id: string }>('SELECT id FROM consumer_systems WHERE is_active = 1');
  for (const consumer of consumers) {
    await run(
      `INSERT OR IGNORE INTO consumer_progress (
        id, batch_id, consumer_id, status, consumed_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [uuidv4(), batchId, consumer.id, ConsumerStatus.PENDING, Date.now(), Date.now()]
    );
  }
}

export async function consumerAck(batchId: string, consumerId: string, success: boolean, errorMessage?: string): Promise<void> {
  const now = Date.now();
  const nodes = await getDepartmentNodes(batchId);

  await run(
    `UPDATE consumer_progress 
     SET status = ?, consumed_count = ?, error_message = ?, ack_at = ?, updated_at = ?
     WHERE batch_id = ? AND consumer_id = ?`,
    [
      success ? ConsumerStatus.ACKNOWLEDGED : ConsumerStatus.FAILED,
      success ? nodes.length : 0,
      errorMessage || null,
      now,
      now,
      batchId,
      consumerId
    ]
  );

  const allProgress = await all<any>(
    'SELECT * FROM consumer_progress WHERE batch_id = ?',
    [batchId]
  ).then(rows => rows.map((row: any) => ({
    id: row.id,
    batchId: row.batch_id,
    consumerId: row.consumer_id,
    status: row.status,
    consumedCount: row.consumed_count,
    lastConsumedNodeId: row.last_consumed_node_id,
    errorMessage: row.error_message,
    ackAt: row.ack_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })));

  const allAcked = allProgress.every(p => p.status === ConsumerStatus.ACKNOWLEDGED);
  const anyFailed = allProgress.some(p => p.status === ConsumerStatus.FAILED);

  if (anyFailed) {
    await run(
      'UPDATE sync_batches SET status = ?, updated_at = ? WHERE id = ?',
      [BatchStatus.PARTIAL_CONSUMED, now, batchId]
    );
  } else if (allAcked) {
    await run(
      'UPDATE department_nodes SET status = ?, updated_at = ? WHERE batch_id = ?',
      [NodeStatus.CONSUMED, now, batchId]
    );
    await run(
      'UPDATE sync_batches SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
      [BatchStatus.CONSUMED, now, now, batchId]
    );
  }
}

export async function applyManualFix(request: ManualFixRequest): Promise<void> {
  const node = await get<any>('SELECT * FROM department_nodes WHERE id = ?', [request.nodeId]);
  if (!node) {
    throw new Error('Node not found');
  }

  const now = Date.now();
  const updates: string[] = [];
  const params: any[] = [];

  if (request.fixes.deptName) {
    updates.push('dept_name = ?');
    params.push(request.fixes.deptName);
  }
  if (request.fixes.parentDeptId !== undefined) {
    updates.push('parent_dept_id = ?');
    params.push(request.fixes.parentDeptId);
  }
  if (request.fixes.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    params.push(request.fixes.sortOrder);
  }

  if (updates.length > 0) {
    updates.push('status = ?');
    params.push(NodeStatus.PENDING);
    updates.push('updated_at = ?');
    params.push(now);
    params.push(request.nodeId);

    await run(
      `UPDATE department_nodes SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    await run(
      `UPDATE exception_nodes 
       SET is_resolved = 1, resolution = ?, resolved_at = ?, resolved_by = ?
       WHERE node_id = ?`,
      [request.remark, now, request.operator, request.nodeId]
    );

    await run(
      'UPDATE sync_batches SET status = ?, updated_at = ? WHERE id = ?',
      [BatchStatus.CREATED, now, node.batch_id]
    );
  }
}

export async function exportSyncReport(batchId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
  const batch = await getSyncBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const nodes = await getDepartmentNodes(batchId);
  const exceptions = await getExceptionNodes(batchId);
  const progress = await all<any>('SELECT * FROM consumer_progress WHERE batch_id = ?', [batchId]);

  const report = {
    batch,
    departments: nodes.map(n => ({
      deptId: n.deptId,
      deptName: n.deptName,
      parentDeptId: n.parentDeptId,
      level: n.level,
      status: n.status
    })),
    exceptions: exceptions.map(e => ({
      deptId: e.deptId,
      errorType: e.errorType,
      errorMessage: e.errorMessage,
      isResolved: e.isResolved
    })),
    consumerProgress: progress.map((p: any) => ({
      consumerId: p.consumer_id,
      status: p.status,
      consumedCount: p.consumed_count
    }))
  };

  return JSON.stringify(report, null, 2);
}

export async function createConsumerSystem(name: string, description?: string, callbackUrl?: string): Promise<string> {
  const id = uuidv4();
  await run(
    `INSERT INTO consumer_systems (id, name, description, callback_url, created_at, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, name, description || null, callbackUrl || null, Date.now()]
  );
  return id;
}
