import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { runQuery, runExecute, runGet } from '../database';
import type { AudioTask, TaskDetail, CreateTaskRequest, TaskStatus } from '../types';

export const generateSignature = (payload: string, secretKey: string): string => {
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
};

export const createTask = async (request: CreateTaskRequest): Promise<AudioTask> => {
  const taskId = uuidv4();
  const now = new Date().toISOString();

  await runExecute(
    `INSERT INTO audio_tasks (id, audio_url, audio_duration, file_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [taskId, request.audio_url, request.audio_duration, request.file_name, 'pending', now, now]
  );

  const targetId = uuidv4();
  await runExecute(
    `INSERT INTO callback_targets (id, task_id, target_url, secret_key, status)
     VALUES (?, ?, ?, ?, ?)`,
    [targetId, taskId, request.callback_url, request.secret_key || '', 'pending']
  );

  const stages = ['audio_analysis', 'speech_recognition', 'text_processing'];
  for (const stage of stages) {
    await runExecute(
      `INSERT INTO transcription_stages (id, task_id, stage_name, status) VALUES (?, ?, ?, ?)`,
      [uuidv4(), taskId, stage, 'pending']
    );
  }

  await recordStatusHistory(taskId, null, 'pending', 'system', '任务创建');

  return getTaskById(taskId);
};

export const getTaskById = async (taskId: string): Promise<AudioTask> => {
  return runGet('SELECT * FROM audio_tasks WHERE id = ?', [taskId]);
};

export const getTaskDetail = async (taskId: string): Promise<TaskDetail> => {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('任务不存在');

  const [stages, callbackTarget, fragments, failures, retries, history] = await Promise.all([
    runQuery('SELECT * FROM transcription_stages WHERE task_id = ? ORDER BY created_at', [taskId]),
    runGet('SELECT * FROM callback_targets WHERE task_id = ?', [taskId]),
    runQuery('SELECT * FROM text_fragments WHERE task_id = ? ORDER BY start_time', [taskId]),
    runQuery('SELECT * FROM failure_records WHERE task_id = ? ORDER BY created_at DESC', [taskId]),
    runQuery('SELECT * FROM retry_records WHERE task_id = ? ORDER BY created_at DESC', [taskId]),
    runQuery('SELECT * FROM status_history WHERE task_id = ? ORDER BY created_at DESC', [taskId])
  ]);

  return {
    ...task,
    stages,
    callback_target: callbackTarget,
    fragments,
    failures,
    retries,
    history
  };
};

export const listTasks = async (status?: TaskStatus): Promise<AudioTask[]> => {
  if (status) {
    return runQuery('SELECT * FROM audio_tasks WHERE status = ? ORDER BY created_at DESC', [status]);
  }
  return runQuery('SELECT * FROM audio_tasks ORDER BY created_at DESC');
};

export const updateTaskStatus = async (taskId: string, status: TaskStatus, operator = 'system', remark = ''): Promise<void> => {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('任务不存在');

  const now = new Date().toISOString();
  await runExecute('UPDATE audio_tasks SET status = ?, updated_at = ? WHERE id = ?', [status, now, taskId]);
  await recordStatusHistory(taskId, task.status, status, operator, remark);
};

export const recordStatusHistory = async (
  taskId: string,
  fromStatus: string | null,
  toStatus: string,
  operator: string,
  remark: string
): Promise<void> => {
  await runExecute(
    `INSERT INTO status_history (id, task_id, from_status, to_status, operator, remark)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), taskId, fromStatus, toStatus, operator, remark]
  );
};

export const advanceStage = async (taskId: string): Promise<void> => {
  const stages = await runQuery('SELECT * FROM transcription_stages WHERE task_id = ? ORDER BY created_at', [taskId]);
  const now = new Date().toISOString();

  for (const stage of stages) {
    if (stage.status === 'pending') {
      await runExecute(
        'UPDATE transcription_stages SET status = ?, started_at = ?, progress = ? WHERE id = ?',
        ['processing', now, 0, stage.id]
      );
      break;
    }
  }
};

export const completeStage = async (taskId: string, stageName: string): Promise<void> => {
  const now = new Date().toISOString();
  await runExecute(
    'UPDATE transcription_stages SET status = ?, completed_at = ?, progress = ? WHERE task_id = ? AND stage_name = ?',
    ['completed', now, 100, taskId, stageName]
  );
};

export const saveTextFragments = async (taskId: string, fragments: Array<{speaker?: string; start_time: number; end_time: number; content: string; confidence?: number}>): Promise<void> => {
  for (const frag of fragments) {
    await runExecute(
      `INSERT INTO text_fragments (id, task_id, speaker, start_time, end_time, content, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, frag.speaker || null, frag.start_time, frag.end_time, frag.content, frag.confidence || null]
    );
  }
};

export const recordFailure = async (
  taskId: string,
  stage: string,
  errorCode?: string,
  errorMessage?: string,
  requestPayload?: string,
  responseData?: string,
  responsibilityNode?: string,
  targetId?: string
): Promise<void> => {
  await runExecute(
    `INSERT INTO failure_records (id, task_id, target_id, stage, error_code, error_message, request_payload, response_data, responsibility_node)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), taskId, targetId || null, stage, errorCode || null, errorMessage || null, requestPayload || null, responseData || null, responsibilityNode || null]
  );
};

export const executeCallback = async (taskId: string): Promise<{ success: boolean; response?: any }> => {
  const task = await getTaskDetail(taskId);
  if (!task.callback_target) throw new Error('回调目标不存在');

  const fragments = await runQuery('SELECT * FROM text_fragments WHERE task_id = ?', [taskId]);
  const payload = JSON.stringify({
    task_id: taskId,
    status: 'completed',
    audio_url: task.audio_url,
    transcription_result: fragments,
    timestamp: Date.now()
  });

  const signature = task.callback_target.secret_key
    ? generateSignature(payload, task.callback_target.secret_key)
    : null;

  await runExecute(
    'UPDATE callback_targets SET retry_count = retry_count + 1, last_callback_at = ? WHERE task_id = ?',
    [new Date().toISOString(), taskId]
  );

  const shouldFail = task.callback_target.retry_count < 2;

  if (shouldFail) {
    await recordFailure(
      taskId,
      'callback',
      'NETWORK_ERROR',
      '连接超时 - 模拟失败用于演示',
      payload,
      JSON.stringify({ error: 'timeout' }),
      'callback_service',
      task.callback_target.id
    );

    await runExecute(
      'UPDATE callback_targets SET status = ?, next_retry_at = ? WHERE task_id = ?',
      ['retrying', new Date(Date.now() + 60000).toISOString(), taskId]
    );

    await updateTaskStatus(taskId, 'callback_failed', 'system', '回调失败，等待重试');

    return { success: false, response: { error: 'timeout' } };
  }

  await runExecute(
    'UPDATE callback_targets SET status = ? WHERE task_id = ?',
    ['success', taskId]
  );

  await updateTaskStatus(taskId, 'completed', 'system', '回调成功，任务完成');

  return { success: true, response: { code: 0, message: 'success', signature } };
};

export const retryCallback = async (taskId: string): Promise<{ success: boolean }> => {
  const task = await getTaskDetail(taskId);
  if (!task.callback_target) throw new Error('回调目标不存在');

  const retryNumber = task.callback_target.retry_count + 1;

  await runExecute(
    `INSERT INTO retry_records (id, task_id, target_id, retry_number, status)
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), taskId, task.callback_target.id, retryNumber, 'processing']
  );

  const result = await executeCallback(taskId);

  await runExecute(
    'UPDATE retry_records SET status = ?, response_data = ? WHERE task_id = ? AND retry_number = ?',
    [result.success ? 'success' : 'failed', JSON.stringify(result.response), taskId, retryNumber]
  );

  return result;
};

export const getFailedTasks = async (): Promise<any[]> => {
  return runQuery(`
    SELECT t.*, ct.retry_count, ct.max_retries, ct.next_retry_at,
           fr.error_message as last_error
    FROM audio_tasks t
    JOIN callback_targets ct ON t.id = ct.task_id
    LEFT JOIN failure_records fr ON t.id = fr.task_id
    WHERE t.status IN ('callback_failed', 'failed')
    ORDER BY t.created_at DESC
  `);
};

export const exportTaskData = async (taskId: string): Promise<any> => {
  const task = await getTaskDetail(taskId);
  return {
    task: {
      id: task.id,
      audio_url: task.audio_url,
      file_name: task.file_name,
      status: task.status,
      created_at: task.created_at
    },
    transcription: task.fragments,
    callback_history: {
      target: task.callback_target.target_url,
      retry_count: task.callback_target.retry_count,
      status: task.callback_target.status,
      retries: task.retries
    },
    failures: task.failures,
    status_history: task.history
  };
};
