import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery, Batch, Tenant, Diff, Callback, Task } from './db';

const router = Router();

router.get('/batches', (req: Request, res: Response) => {
  const batches = allQuery<Batch & { tenant_count: number; passed_count: number; failed_count: number }>(`
    SELECT b.*,
           (SELECT COUNT(*) FROM tenants t WHERE t.batch_id = b.id) as tenant_count,
           (SELECT COUNT(*) FROM tenants t WHERE t.batch_id = b.id AND t.status = 'passed') as passed_count,
           (SELECT COUNT(*) FROM tenants t WHERE t.batch_id = b.id AND t.status = 'failed') as failed_count
    FROM batches b
    ORDER BY b.created_at DESC
  `);

  res.json(batches);
});

router.post('/batches', (req: Request, res: Response) => {
  const { name, description } = req.body;
  const now = new Date().toISOString();
  const id = uuidv4();

  runQuery(`
    INSERT INTO batches (id, name, description, status, created_at, updated_at)
    VALUES (?, ?, ?, 'open', ?, ?)
  `, [id, name, description || '', now, now]);

  res.status(201).json({ id, name, description, status: 'open', created_at: now, updated_at: now });
});

router.get('/batches/:id', (req: Request, res: Response) => {
  const batch = getQuery<Batch>('SELECT * FROM batches WHERE id = ?', [req.params.id]);
  
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  const tenants = allQuery(`
    SELECT t.*,
           (SELECT COUNT(*) FROM diffs d WHERE d.tenant_id = t.id AND d.status = 'pending') as pending_diffs,
           (SELECT COUNT(*) FROM diffs d WHERE d.tenant_id = t.id AND d.status = 'retry') as retry_diffs,
           (SELECT COUNT(*) FROM diffs d WHERE d.tenant_id = t.id AND d.status = 'business_decision') as business_diffs,
           (SELECT COUNT(*) FROM callbacks c WHERE c.tenant_id = t.id AND c.is_switched = 0) as unswitched_callbacks,
           (SELECT COUNT(*) FROM tasks tk WHERE tk.tenant_id = t.id AND tk.is_frozen = 1) as frozen_tasks
    FROM tenants t
    WHERE t.batch_id = ?
    ORDER BY t.created_at ASC
  `, [req.params.id]);

  res.json({ ...batch, tenants });
});

router.post('/batches/:id/close', (req: Request, res: Response) => {
  const batchId = req.params.id;
  const now = new Date().toISOString();

  const pendingDiffs = getQuery<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM diffs d
    JOIN tenants t ON d.tenant_id = t.id
    WHERE t.batch_id = ? AND d.status IN ('pending', 'retry', 'business_decision')
  `, [batchId]);

  if (pendingDiffs && pendingDiffs.count > 0) {
    return res.status(400).json({ 
      error: '存在未确认的差异，无法关闭批次',
      pending_count: pendingDiffs.count
    });
  }

  const unswitchedCallbacks = getQuery<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM callbacks c
    JOIN tenants t ON c.tenant_id = t.id
    WHERE t.batch_id = ? AND c.is_switched = 0
  `, [batchId]);

  if (unswitchedCallbacks && unswitchedCallbacks.count > 0) {
    return res.status(400).json({ 
      error: '存在未切换的回调地址，无法关闭批次',
      unswitched_count: unswitchedCallbacks.count
    });
  }

  runQuery(`
    UPDATE batches SET status = 'closed', updated_at = ? WHERE id = ?
  `, [now, batchId]);

  runQuery(`
    UPDATE tenants SET status = 'passed', updated_at = ? WHERE batch_id = ?
  `, [now, batchId]);

  res.json({ success: true });
});

router.post('/batches/:id/tenants', (req: Request, res: Response) => {
  const batchId = req.params.id;
  const { tenantId, tenantName } = req.body;
  const now = new Date().toISOString();
  const id = uuidv4();

  runQuery(`
    INSERT INTO tenants (id, batch_id, tenant_id, tenant_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `, [id, batchId, tenantId, tenantName, now, now]);

  res.status(201).json({ id, batch_id: batchId, tenant_id: tenantId, tenant_name: tenantName, status: 'pending', created_at: now, updated_at: now });
});

router.get('/tenants/:id', (req: Request, res: Response) => {
  const tenant = getQuery<Tenant>('SELECT * FROM tenants WHERE id = ?', [req.params.id]);

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  const snapshots = allQuery('SELECT * FROM snapshots WHERE tenant_id = ?', [req.params.id]);
  const diffs = allQuery('SELECT * FROM diffs WHERE tenant_id = ?', [req.params.id]);
  const callbacks = allQuery('SELECT * FROM callbacks WHERE tenant_id = ?', [req.params.id]);
  const tasks = allQuery('SELECT * FROM tasks WHERE tenant_id = ?', [req.params.id]);

  res.json({
    ...tenant,
    snapshots,
    diffs,
    callbacks,
    tasks
  });
});

router.post('/tenants/:id/snapshots', (req: Request, res: Response) => {
  const tenantId = req.params.id;
  const { environment, data } = req.body;
  const now = new Date().toISOString();

  const existing = getQuery('SELECT * FROM snapshots WHERE tenant_id = ? AND environment = ?', [tenantId, environment]);
  
  if (existing) {
    const manualDiffs = getQuery<{ count: number }>(`
      SELECT COUNT(*) as count FROM diffs WHERE tenant_id = ? AND has_manual_conclusion = 1
    `, [tenantId]);

    if (manualDiffs && manualDiffs.count > 0) {
      return res.status(400).json({ 
        error: '该租户已有人工结论，无法覆盖快照'
      });
    }

    runQuery(`
      UPDATE snapshots SET data = ?, imported_at = ? WHERE tenant_id = ? AND environment = ?
    `, [JSON.stringify(data), now, tenantId, environment]);
  } else {
    const id = uuidv4();
    runQuery(`
      INSERT INTO snapshots (id, tenant_id, environment, imported_at, data)
      VALUES (?, ?, ?, ?, ?)
    `, [id, tenantId, environment, now, JSON.stringify(data)]);
  }

  res.json({ success: true });
});

router.post('/tenants/:id/validate', (req: Request, res: Response) => {
  const tenantId = req.params.id;
  const now = new Date().toISOString();

  const oldSnapshot = getQuery<{ data: string }>('SELECT * FROM snapshots WHERE tenant_id = ? AND environment = ?', [tenantId, 'old']);
  const newSnapshot = getQuery<{ data: string }>('SELECT * FROM snapshots WHERE tenant_id = ? AND environment = ?', [tenantId, 'new']);

  if (!oldSnapshot || !newSnapshot) {
    return res.status(400).json({ error: '缺少旧环境或新环境快照' });
  }

  const oldData = JSON.parse(oldSnapshot.data);
  const newData = JSON.parse(newSnapshot.data);

  const oldPerms = new Set(oldData.permissions || []);
  const newPerms = new Set(newData.permissions || []);
  const missingPerms = Array.from(oldPerms).filter(p => !newPerms.has(p));
  const extraPerms = Array.from(newPerms).filter(p => !oldPerms.has(p));

  const oldTasks = new Set((oldData.tasks || []).map((t: any) => `${t.name}-${t.type}-${t.cron || ''}`));
  const newTasks = new Set((newData.tasks || []).map((t: any) => `${t.name}-${t.type}-${t.cron || ''}`));
  const missingTasks = Array.from(oldTasks).filter(t => !newTasks.has(t));
  const extraTasks = Array.from(newTasks).filter(t => !oldTasks.has(t));

  const dataDiffStatus = oldData.dataCount === newData.dataCount ? 'confirmed' : 'pending';
  const dataDiffConclusion = `旧环境: ${oldData.dataCount} 条, 新环境: ${newData.dataCount} 条`;

  const permDiffStatus = missingPerms.length === 0 && extraPerms.length === 0 ? 'confirmed' : 'pending';
  const permDiffConclusion = `缺少权限: ${missingPerms.join(', ') || '无'}, 额外权限: ${extraPerms.join(', ') || '无'}`;

  const taskDiffStatus = missingTasks.length === 0 && extraTasks.length === 0 ? 'confirmed' : 'pending';
  const taskDiffConclusion = `缺少任务: ${missingTasks.length} 个, 额外任务: ${extraTasks.length} 个`;

  const oldCallbacks = oldData.callbacks || [];
  const newCallbacks = newData.callbacks || [];
  const callbackDiffs: { service: string; oldUrl: string; newUrl: string }[] = [];
  
  for (const oldCb of oldCallbacks) {
    const newCb = newCallbacks.find((c: any) => c.service === oldCb.service);
    if (newCb) {
      callbackDiffs.push({
        service: oldCb.service,
        oldUrl: oldCb.url,
        newUrl: newCb.url
      });
    }
  }

  const unswitchedCallbacks = callbackDiffs.filter(c => c.oldUrl === c.newUrl);
  const callbackDiffStatus = unswitchedCallbacks.length === 0 ? 'confirmed' : 'pending';
  const callbackDiffConclusion = `未切换回调: ${unswitchedCallbacks.length} 个`;

  runQuery('DELETE FROM diffs WHERE tenant_id = ? AND has_manual_conclusion = 0', [tenantId]);

  const diffTypes = [
    { type: 'data', status: dataDiffStatus, conclusion: dataDiffConclusion },
    { type: 'permission', status: permDiffStatus, conclusion: permDiffConclusion },
    { type: 'task', status: taskDiffStatus, conclusion: taskDiffConclusion },
    { type: 'callback', status: callbackDiffStatus, conclusion: callbackDiffConclusion }
  ];

  for (const diff of diffTypes) {
    const existing = getQuery('SELECT * FROM diffs WHERE tenant_id = ? AND type = ?', [tenantId, diff.type]);
    
    if (!existing) {
      runQuery(`
        INSERT INTO diffs (id, tenant_id, type, status, conclusion, created_at, updated_at, has_manual_conclusion)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `, [uuidv4(), tenantId, diff.type, diff.status, diff.conclusion, now, now]);
    }
  }

  runQuery('DELETE FROM callbacks WHERE tenant_id = ?', [tenantId]);
  for (const cb of callbackDiffs) {
    runQuery(`
      INSERT INTO callbacks (id, tenant_id, service_name, old_url, new_url, is_switched)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [uuidv4(), tenantId, cb.service, cb.oldUrl, cb.newUrl, cb.oldUrl !== cb.newUrl ? 1 : 0]);
  }

  runQuery('DELETE FROM tasks WHERE tenant_id = ?', [tenantId]);
  for (const task of oldData.tasks || []) {
    runQuery(`
      INSERT INTO tasks (id, tenant_id, task_name, task_type, is_frozen)
      VALUES (?, ?, ?, ?, 0)
    `, [uuidv4(), tenantId, task.name, task.type]);
  }

  const allPending = getQuery<{ count: number }>(`
    SELECT COUNT(*) as count FROM diffs WHERE tenant_id = ? AND status != 'confirmed'
  `, [tenantId]);

  const newStatus = (allPending?.count || 0) === 0 ? 'passed' : 'in_progress';
  runQuery('UPDATE tenants SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now, tenantId]);

  res.json({ success: true });
});

router.post('/diffs/:id/confirm', (req: Request, res: Response) => {
  const diffId = req.params.id;
  const { status, conclusion } = req.body;
  const now = new Date().toISOString();

  const validStatuses = ['confirmed', 'retry', 'business_decision'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }

  runQuery(`
    UPDATE diffs 
    SET status = ?, conclusion = ?, has_manual_conclusion = 1, updated_at = ?
    WHERE id = ?
  `, [status, conclusion || '', now, diffId]);

  const diff = getQuery<Diff>('SELECT * FROM diffs WHERE id = ?', [diffId]);
  if (diff) {
    const allDiffs = allQuery<Diff>('SELECT * FROM diffs WHERE tenant_id = ?', [diff.tenant_id]);
    const allResolved = allDiffs.every(d => d.status === 'confirmed');
    
    if (allResolved) {
      const allCallbacks = allQuery<Callback>('SELECT * FROM callbacks WHERE tenant_id = ?', [diff.tenant_id]);
      const allSwitched = allCallbacks.every(c => c.is_switched === 1);
      
      if (allSwitched) {
        runQuery(`
          UPDATE tenants SET status = 'passed', updated_at = ? WHERE id = ?
        `, [now, diff.tenant_id]);
      }
    }
  }

  res.json({ success: true });
});

router.post('/diffs/:id/retry', (req: Request, res: Response) => {
  const diffId = req.params.id;
  const now = new Date().toISOString();

  runQuery(`
    UPDATE diffs 
    SET status = 'retry', has_manual_conclusion = 1, updated_at = ?
    WHERE id = ?
  `, [now, diffId]);

  res.json({ success: true });
});

router.post('/tasks/:id/freeze', (req: Request, res: Response) => {
  const taskId = req.params.id;
  const now = new Date().toISOString();

  runQuery(`
    UPDATE tasks SET is_frozen = 1, frozen_at = ? WHERE id = ?
  `, [now, taskId]);

  res.json({ success: true });
});

router.post('/tasks/:id/unfreeze', (req: Request, res: Response) => {
  const taskId = req.params.id;
  const now = new Date().toISOString();

  runQuery(`
    UPDATE tasks SET is_frozen = 0, unfrozen_at = ? WHERE id = ?
  `, [now, taskId]);

  res.json({ success: true });
});

router.post('/callbacks/:id/switch', (req: Request, res: Response) => {
  const callbackId = req.params.id;
  const now = new Date().toISOString();

  const callback = getQuery<Callback>('SELECT * FROM callbacks WHERE id = ?', [callbackId]);
  if (!callback) {
    return res.status(404).json({ error: '回调记录不存在' });
  }

  if (callback.old_url === callback.new_url) {
    return res.status(400).json({ error: '新旧地址相同，无法切换' });
  }

  const tenant = getQuery<Tenant>('SELECT * FROM tenants WHERE id = ?', [callback.tenant_id]);
  if (!tenant) {
    return res.status(404).json({ error: '租户不存在' });
  }

  const pendingDiffs = getQuery<{ count: number }>(`
    SELECT COUNT(*) as count FROM diffs 
    WHERE tenant_id = ? AND status != 'confirmed'
  `, [tenant.id]);

  if (pendingDiffs && pendingDiffs.count > 0) {
    return res.status(400).json({ 
      error: '迁移未完成，存在待处理差异，无法切换回调',
      pending_count: pendingDiffs.count
    });
  }

  runQuery(`
    UPDATE callbacks SET is_switched = 1, switched_at = ? WHERE id = ?
  `, [now, callbackId]);

  const allCallbacks = allQuery<Callback>('SELECT * FROM callbacks WHERE tenant_id = ?', [tenant.id]);
  const allSwitched = allCallbacks.every(c => c.is_switched === 1);
  
  if (allSwitched) {
    const allDiffs = allQuery<Diff>('SELECT * FROM diffs WHERE tenant_id = ?', [tenant.id]);
    const allConfirmed = allDiffs.every(d => d.status === 'confirmed');
    
    if (allConfirmed) {
      runQuery(`
        UPDATE tenants SET status = 'passed', updated_at = ? WHERE id = ?
      `, [now, tenant.id]);
    }
  }

  res.json({ success: true });
});

router.get('/batches/:id/report', (req: Request, res: Response) => {
  const batchId = req.params.id;
  const batch = getQuery<Batch>('SELECT * FROM batches WHERE id = ?', [batchId]);

  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const tenants = allQuery<Tenant>('SELECT * FROM tenants WHERE batch_id = ?', [batchId]);
  const report: any[] = [];

  for (const tenant of tenants) {
    const diffs = allQuery<Diff>('SELECT * FROM diffs WHERE tenant_id = ?', [tenant.id]);
    const callbacks = allQuery<Callback>('SELECT * FROM callbacks WHERE tenant_id = ?', [tenant.id]);
    const tasks = allQuery<Task>('SELECT * FROM tasks WHERE tenant_id = ?', [tenant.id]);

    report.push({
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.tenant_name,
      status: tenant.status,
      diffs: diffs.map(d => ({
        type: d.type,
        status: d.status,
        conclusion: d.conclusion
      })),
      callbacks: callbacks.map(c => ({
        service_name: c.service_name,
        is_switched: c.is_switched === 1
      })),
      tasks: tasks.map(t => ({
        task_name: t.task_name,
        is_frozen: t.is_frozen === 1
      }))
    });
  }

  res.json({
    batch_name: batch.name,
    batch_status: batch.status,
    generated_at: new Date().toISOString(),
    tenants: report
  });
});

export default router;
