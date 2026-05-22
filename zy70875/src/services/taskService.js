const { run, get, all, generateId, getCurrentTime } = require('../utils/database');
const { calculateBatch } = require('./calculationService');
const { getBatchById, updateBatchStatus } = require('./batchService');
const { recordAuditLog } = require('./auditService');

async function createTask(batchId) {
  const taskId = generateId();
  const now = getCurrentTime();
  
  await run(
    `INSERT INTO tasks (id, batchId, status, progress, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [taskId, batchId, 'processing', 0, now, now]
  );
  
  return getTaskById(taskId);
}

async function getTaskById(taskId) {
  return get('SELECT * FROM tasks WHERE id = ?', [taskId]);
}

async function getTasksByBatchId(batchId) {
  return all('SELECT * FROM tasks WHERE batchId = ? ORDER BY createdAt DESC', [batchId]);
}

async function updateTaskStatus(taskId, status, progress = null, errorMessage = null) {
  const now = getCurrentTime();
  
  const updates = [];
  const params = [];
  
  if (status) {
    updates.push('status = ?');
    params.push(status);
  }
  if (progress !== null) {
    updates.push('progress = ?');
    params.push(progress);
  }
  if (errorMessage !== null) {
    updates.push('errorMessage = ?');
    params.push(errorMessage);
  }
  
  updates.push('updatedAt = ?');
  params.push(now);
  params.push(taskId);
  
  const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
  await run(sql, params);
  
  return getTaskById(taskId);
}

async function saveCalculationResults(taskId, results) {
  const now = getCurrentTime();
  
  await run('DELETE FROM calculation_results WHERE taskId = ?', [taskId]);
  
  for (const result of results) {
    const resultId = generateId();
    await run(
      `INSERT INTO calculation_results 
       (id, taskId, screeningId, cinemaId, cinemaName, filmId, filmName, category, reason, subsidyAmount, details, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId,
        taskId,
        result.screeningId,
        result.cinemaId,
        result.cinemaName,
        result.filmId,
        result.filmName,
        result.category,
        result.reason || null,
        result.subsidyAmount,
        JSON.stringify(result.calculationDetails),
        now
      ]
    );
  }
}

async function getCalculationResults(taskId) {
  const results = await all('SELECT * FROM calculation_results WHERE taskId = ?', [taskId]);
  
  return results.map(r => ({
    ...r,
    details: r.details ? JSON.parse(r.details) : null
  }));
}

async function getCalculationResultById(resultId) {
  const result = await get('SELECT * FROM calculation_results WHERE id = ?', [resultId]);
  
  if (!result) return null;
  
  return {
    ...result,
    details: result.details ? JSON.parse(result.details) : null
  };
}

async function processBatch(batchId) {
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  const task = await createTask(batchId);
  const taskId = task.id;
  
  setImmediate(async () => {
    try {
      await updateTaskStatus(taskId, 'processing', 10);
      
      const rawData = batch.rawData || [];
      
      await updateTaskStatus(taskId, 'processing', 30);
      
      const { results, summary } = calculateBatch(rawData);
      
      await updateTaskStatus(taskId, 'processing', 70);
      
      await saveCalculationResults(taskId, results);
      
      await updateTaskStatus(taskId, 'processing', 90);
      
      const hasPending = results.some(r => r.category === 'pending');
      const finalStatus = hasPending ? 'pending_confirmation' : 'completed';
      
      await updateTaskStatus(taskId, finalStatus, 100);
      await updateBatchStatus(batchId, finalStatus);
      
    } catch (error) {
      await updateTaskStatus(taskId, 'failed', 0, error.message);
      await updateBatchStatus(batchId, 'failed');
    }
  });
  
  return task;
}

async function confirmTask(taskId, operator) {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }
  
  if (task.status !== 'pending_confirmation') {
    throw new Error('只有待确认状态的任务才能人工确认');
  }
  
  await updateTaskStatus(taskId, 'completed', 100);
  
  await recordAuditLog({
    taskId,
    operator,
    action: 'confirm',
    beforeData: { status: task.status },
    afterData: { status: 'completed' },
    reason: '人工确认通过'
  });
  
  return getTaskById(taskId);
}

async function modifyConclusion(resultId, operator, newCategory, newSubsidyAmount, reason) {
  const result = await getCalculationResultById(resultId);
  if (!result) {
    throw new Error('核算结果不存在');
  }
  
  const beforeData = {
    category: result.category,
    subsidyAmount: result.subsidyAmount
  };
  
  await run(
    `UPDATE calculation_results 
     SET category = ?, subsidyAmount = ?, reason = ?
     WHERE id = ?`,
    [newCategory, newSubsidyAmount, `人工修改: ${reason}`, resultId]
  );
  
  const afterData = {
    category: newCategory,
    subsidyAmount: newSubsidyAmount
  };
  
  await recordAuditLog({
    taskId: result.taskId,
    operator,
    action: 'modify_conclusion',
    beforeData,
    afterData,
    reason
  });
  
  return getCalculationResultById(resultId);
}

async function markTaskExported(taskId, operator) {
  await updateTaskStatus(taskId, 'exported', 100);
  
  const task = await getTaskById(taskId);
  await updateBatchStatus(task.batchId, 'exported');
  
  await recordAuditLog({
    taskId,
    operator,
    action: 'export',
    beforeData: { status: task.status },
    afterData: { status: 'exported' },
    reason: '导出核算报告'
  });
  
  return getTaskById(taskId);
}

module.exports = {
  createTask,
  getTaskById,
  getTasksByBatchId,
  updateTaskStatus,
  saveCalculationResults,
  getCalculationResults,
  getCalculationResultById,
  processBatch,
  confirmTask,
  modifyConclusion,
  markTaskExported
};
