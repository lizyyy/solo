const db = require('../database');
const { generateId, now, parseJSON, stringifyJSON, classifyError, computeDiff, getSafeFields } = require('../utils');
const businessData = require('../businessData');

const createTask = (taskData) => {
  const {
    taskType,
    taskName,
    businessNo,
    payload,
    maxRetry = 3,
    hasSideEffect = false,
    sideEffectType = null,
    idempotentKey = null
  } = taskData;

  const payloadStr = typeof payload === 'string' ? payload : stringifyJSON(payload);
  const id = generateId();
  const finalIdempotentKey = idempotentKey || `task_${taskType}_${businessNo || id}`;

  db.prepare(`
    INSERT INTO tasks (
      id, task_type, task_name, business_no, payload, original_payload,
      status, retry_count, max_retry, idempotent_key, has_side_effect,
      side_effect_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, taskType, taskName, businessNo, payloadStr, payloadStr,
    'pending', 0, maxRetry, finalIdempotentKey, hasSideEffect ? 1 : 0,
    sideEffectType, now(), now()
  );

  return getTask(id);
};

const getTask = (id) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return null;
  return formatTask(task);
};

const formatTask = (task) => ({
  ...task,
  payload: parseJSON(task.payload),
  original_payload: parseJSON(task.original_payload),
  has_side_effect: task.has_side_effect === 1
});

const getTasks = (filters = {}) => {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.taskType) {
    query += ' AND task_type = ?';
    params.push(filters.taskType);
  }
  if (filters.businessNo) {
    query += ' AND business_no LIKE ?';
    params.push(`%${filters.businessNo}%`);
  }

  query += ' ORDER BY created_at DESC';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const tasks = db.prepare(query).all(...params);
  return tasks.map(formatTask);
};

const updateTaskStatus = (taskId, status, additionalData = {}) => {
  const updates = ['status = ?', 'updated_at = ?'];
  const params = [status, now()];

  for (const [key, value] of Object.entries(additionalData)) {
    updates.push(`${key} = ?`);
    params.push(value);
  }
  params.push(taskId);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return getTask(taskId);
};

const moveToDeadLetter = (taskId, error) => {
  const task = getTask(taskId);
  if (!task) throw new Error('Task not found');

  const errorMsg = error?.message || String(error);
  const errorStack = error?.stack || null;
  const errorCategory = classifyError(error);

  const newRetryCount = task.retry_count + 1;
  const needManual = newRetryCount >= task.max_retry;

  const deadLetterId = generateId();
  db.prepare(`
    INSERT INTO dead_letters (
      id, task_id, error_message, error_stack, error_category,
      payload_snapshot, retry_count, status, need_manual, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    deadLetterId, taskId, errorMsg, errorStack, errorCategory,
    stringifyJSON(task.payload), newRetryCount, 'active', needManual ? 1 : 0,
    now(), now()
  );

  updateTaskStatus(taskId, needManual ? 'manual_required' : 'dead_letter', {
    retry_count: newRetryCount
  });

  return getDeadLetter(deadLetterId);
};

const getDeadLetter = (id) => {
  const dl = db.prepare(`
    SELECT dl.*, t.task_type, t.task_name, t.business_no, t.has_side_effect, t.side_effect_type,
           t.payload as current_payload, t.original_payload
    FROM dead_letters dl
    JOIN tasks t ON dl.task_id = t.id
    WHERE dl.id = ?
  `).get(id);

  if (!dl) return null;

  return {
    ...dl,
    payload_snapshot: parseJSON(dl.payload_snapshot),
    current_payload: parseJSON(dl.current_payload),
    original_payload: parseJSON(dl.original_payload),
    has_side_effect: dl.has_side_effect === 1,
    need_manual: dl.need_manual === 1
  };
};

const getDeadLetters = (filters = {}) => {
  let query = `
    SELECT dl.*, t.task_type, t.task_name, t.business_no, t.has_side_effect
    FROM dead_letters dl
    JOIN tasks t ON dl.task_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    query += ' AND dl.status = ?';
    params.push(filters.status);
  }
  if (filters.taskType) {
    query += ' AND t.task_type = ?';
    params.push(filters.taskType);
  }
  if (filters.needManual) {
    query += ' AND dl.need_manual = 1';
  }

  query += ' ORDER BY dl.created_at DESC';

  const deadLetters = db.prepare(query).all(...params);
  return deadLetters.map(dl => ({
    ...dl,
    payload_snapshot: parseJSON(dl.payload_snapshot),
    has_side_effect: dl.has_side_effect === 1,
    need_manual: dl.need_manual === 1
  }));
};

const modifyPayload = (taskId, newPayload, operator = 'system', reason = '') => {
  const task = getTask(taskId);
  if (!task) throw new Error('Task not found');

  const payloadBefore = typeof task.payload === 'string' ? parseJSON(task.payload) : task.payload;
  const payloadAfter = typeof newPayload === 'string' ? parseJSON(newPayload) : newPayload;

  const safeFields = getSafeFields(task.task_type);
  const diff = computeDiff(payloadBefore, payloadAfter);

  const modificationId = generateId();
  db.prepare(`
    INSERT INTO payload_modifications (
      id, task_id, payload_before, payload_after, diff,
      safe_fields, operator, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    modificationId, taskId,
    stringifyJSON(payloadBefore),
    stringifyJSON(payloadAfter),
    stringifyJSON(diff),
    stringifyJSON(safeFields),
    operator, reason, now()
  );

  db.prepare('UPDATE tasks SET payload = ?, updated_at = ? WHERE id = ?')
    .run(stringifyJSON(payloadAfter), now(), taskId);

  return {
    id: modificationId,
    diff,
    safeFields,
    payloadBefore,
    payloadAfter
  };
};

const getModificationHistory = (taskId) => {
  const mods = db.prepare(`
    SELECT * FROM payload_modifications 
    WHERE task_id = ? 
    ORDER BY created_at DESC
  `).all(taskId);

  return mods.map(m => ({
    ...m,
    payload_before: parseJSON(m.payload_before),
    payload_after: parseJSON(m.payload_after),
    diff: parseJSON(m.diff),
    safe_fields: parseJSON(m.safe_fields)
  }));
};

const getReplayHistory = (deadLetterId) => {
  const history = db.prepare(`
    SELECT * FROM replay_history 
    WHERE dead_letter_id = ? 
    ORDER BY created_at DESC
  `).all(deadLetterId);

  return history.map(h => ({
    ...h,
    payload_before: parseJSON(h.payload_before),
    payload_after: parseJSON(h.payload_after),
    diff: h.diff ? parseJSON(h.diff) : null,
    result: h.result ? parseJSON(h.result) : null
  }));
};

const getReplayHistoryByIdempotentKey = (idempotentKey) => {
  return db.prepare(`
    SELECT * FROM replay_history 
    WHERE idempotent_key = ? 
    ORDER BY created_at DESC
  `).all(idempotentKey).map(h => ({
    ...h,
    result: h.result ? parseJSON(h.result) : null
  }));
};

const executeTaskHandler = (task) => {
  const payload = task.payload;
  
  switch (task.task_type) {
    case 'invoice':
      return executeInvoiceTask(task, payload);
    case 'sms':
      return executeSmsTask(task, payload);
    case 'inventory':
      return executeInventoryTask(task, payload);
    default:
      return { success: true, result: { message: 'Unknown task type, skipping' } };
  }
};

const executeInvoiceTask = (task, payload) => {
  const businessNo = task.business_no || payload.orderId;
  
  const before = businessData.getInvoice(businessNo);
  
  const result = businessData.createOrUpdateInvoice(businessNo, {
    invoiceNo: payload.invoiceNo || `INV-${Date.now()}`,
    status: 'issued',
    amount: payload.amount
  });
  
  const after = businessData.getInvoice(businessNo);
  
  return {
    success: true,
    result: { invoice: result },
    businessSnapshot: {
      type: 'invoice',
      businessNo,
      before,
      after
    }
  };
};

const executeSmsTask = (task, payload) => {
  const businessNo = task.business_no || payload.messageId;
  
  const before = businessData.getSms(businessNo);
  
  const result = businessData.createOrUpdateSms(businessNo, {
    phone: payload.phone,
    content: payload.content,
    sent: true,
    status: 'sent'
  });
  
  const after = businessData.getSms(businessNo);
  
  return {
    success: true,
    result: { sms: result, sentCount: after.sent_count },
    businessSnapshot: {
      type: 'sms',
      businessNo,
      before,
      after
    }
  };
};

const executeInventoryTask = (task, payload) => {
  const businessNo = task.business_no || payload.orderId;
  const productId = payload.productId;
  
  const before = businessData.getInventory(productId);
  
  const result = businessData.updateInventory(
    productId,
    -payload.quantity,
    businessNo,
    payload.reason || 'Order deduction'
  );
  
  const after = businessData.getInventory(productId);
  
  return {
    success: true,
    result: { inventory: result },
    businessSnapshot: {
      type: 'inventory',
      businessNo,
      productId,
      before,
      after
    }
  };
};

const replayDeadLetter = (deadLetterId, operator = 'system') => {
  const deadLetter = getDeadLetter(deadLetterId);
  if (!deadLetter) throw new Error('Dead letter not found');

  if (deadLetter.status === 'resolved') {
    throw new Error('Task is already resolved and cannot be replayed');
  }
  if (deadLetter.status === 'closed') {
    throw new Error('Task is closed and cannot be replayed');
  }

  const task = getTask(deadLetter.task_id);
  
  const existingReplay = getReplayHistoryByIdempotentKey(task.idempotent_key)
    .find(h => h.status === 'success');
  if (existingReplay) {
    throw new Error('This task has already been successfully replayed (idempotency check)');
  }

  const payloadBefore = deadLetter.payload_snapshot;
  const payloadAfter = task.payload;
  const diff = computeDiff(payloadBefore, payloadAfter);

  const replayHistoryId = generateId();
  
  let result;
  let status;
  let errorMessage = null;
  let businessSnapshot = null;

  try {
    const executionResult = executeTaskHandler(task);
    result = executionResult.result;
    businessSnapshot = executionResult.businessSnapshot;
    status = 'success';

    db.prepare(`
      UPDATE dead_letters 
      SET status = 'resolved', updated_at = ? 
      WHERE id = ?
    `).run(now(), deadLetterId);

    updateTaskStatus(deadLetter.task_id, 'completed');

  } catch (err) {
    result = null;
    errorMessage = err.message;
    status = 'failed';

    const newRetryCount = deadLetter.retry_count + 1;
    const needManual = newRetryCount >= task.max_retry;

    db.prepare(`
      UPDATE dead_letters 
      SET retry_count = ?, need_manual = ?, updated_at = ? 
      WHERE id = ?
    `).run(newRetryCount, needManual ? 1 : 0, now(), deadLetterId);

    updateTaskStatus(deadLetter.task_id, needManual ? 'manual_required' : 'dead_letter', {
      retry_count: task.retry_count + 1
    });
  }

  db.prepare(`
    INSERT INTO replay_history (
      id, dead_letter_id, task_id, idempotent_key, payload_before,
      payload_after, diff, status, result, error_message, operator, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    replayHistoryId, deadLetterId, deadLetter.task_id, task.idempotent_key,
    stringifyJSON(payloadBefore), stringifyJSON(payloadAfter),
    diff.length > 0 ? stringifyJSON(diff) : null,
    status, result ? stringifyJSON(result) : null,
    errorMessage, operator, now()
  );

  if (businessSnapshot && status === 'success') {
    db.prepare(`
      INSERT INTO business_snapshots (
        id, task_id, replay_history_id, business_type, business_no,
        snapshot_before, snapshot_after, diff, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(), deadLetter.task_id, replayHistoryId,
      businessSnapshot.type, businessSnapshot.businessNo,
      businessSnapshot.before ? stringifyJSON(businessSnapshot.before) : null,
      businessSnapshot.after ? stringifyJSON(businessSnapshot.after) : null,
      stringifyJSON(computeDiff(businessSnapshot.before || {}, businessSnapshot.after || {})),
      now()
    );
  }

  return {
    id: replayHistoryId,
    status,
    result,
    errorMessage,
    businessSnapshot
  };
};

const closeDeadLetter = (deadLetterId, reason = '', operator = 'system') => {
  const deadLetter = getDeadLetter(deadLetterId);
  if (!deadLetter) throw new Error('Dead letter not found');

  db.prepare(`
    UPDATE dead_letters 
    SET status = 'closed', updated_at = ? 
    WHERE id = ?
  `).run(now(), deadLetterId);

  updateTaskStatus(deadLetter.task_id, 'closed');

  return getDeadLetter(deadLetterId);
};

const getBusinessSnapshots = (taskId) => {
  const snapshots = db.prepare(`
    SELECT * FROM business_snapshots 
    WHERE task_id = ? 
    ORDER BY created_at DESC
  `).all(taskId);

  return snapshots.map(s => ({
    ...s,
    snapshot_before: s.snapshot_before ? parseJSON(s.snapshot_before) : null,
    snapshot_after: s.snapshot_after ? parseJSON(s.snapshot_after) : null,
    diff: s.diff ? parseJSON(s.diff) : null
  }));
};

const exportData = (type, filters = {}) => {
  if (type === 'tasks') {
    return getTasks(filters);
  }
  if (type === 'dead_letters') {
    return getDeadLetters(filters);
  }
  return [];
};

const getStatistics = () => {
  const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  const pendingTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'").get().count;
  const completedTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get().count;
  const failedTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status IN ('dead_letter', 'manual_required', 'closed')").get().count;

  const totalDeadLetters = db.prepare('SELECT COUNT(*) as count FROM dead_letters').get().count;
  const activeDeadLetters = db.prepare("SELECT COUNT(*) as count FROM dead_letters WHERE status = 'active'").get().count;
  const resolvedDeadLetters = db.prepare("SELECT COUNT(*) as count FROM dead_letters WHERE status = 'resolved'").get().count;
  const closedDeadLetters = db.prepare("SELECT COUNT(*) as count FROM dead_letters WHERE status = 'closed'").get().count;
  const needManual = db.prepare('SELECT COUNT(*) as count FROM dead_letters WHERE need_manual = 1').get().count;

  const errorCategories = db.prepare(`
    SELECT error_category, COUNT(*) as count 
    FROM dead_letters 
    GROUP BY error_category
  `).all();

  const taskTypes = db.prepare(`
    SELECT task_type, COUNT(*) as count 
    FROM tasks 
    GROUP BY task_type
  `).all();

  return {
    tasks: {
      total: totalTasks,
      pending: pendingTasks,
      completed: completedTasks,
      failed: failedTasks
    },
    deadLetters: {
      total: totalDeadLetters,
      active: activeDeadLetters,
      resolved: resolvedDeadLetters,
      closed: closedDeadLetters,
      needManual
    },
    errorCategories,
    taskTypes
  };
};

module.exports = {
  createTask,
  getTask,
  getTasks,
  updateTaskStatus,
  moveToDeadLetter,
  getDeadLetter,
  getDeadLetters,
  modifyPayload,
  getModificationHistory,
  getReplayHistory,
  getReplayHistoryByIdempotentKey,
  replayDeadLetter,
  closeDeadLetter,
  getBusinessSnapshots,
  exportData,
  getStatistics
};
