import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { runQuery, runExecute, runGet } from '../database';
import type { AudioTask, TaskDetail, CreateTaskRequest, TaskStatus } from '../types';

export const generateSignature = (payload: string, secretKey: string): string => {
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
};

const httpRequest = (url: string, options: any, payload: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (payload) req.write(payload);
    req.end();
  });
};

export const sendCallbackRequest = async (targetUrl: string, payload: any, secretKey?: string): Promise<{ success: boolean; statusCode?: number; response?: any; error?: string }> => {
  const payloadStr = JSON.stringify(payload);
  const signature = secretKey ? generateSignature(payloadStr, secretKey) : null;
  
  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr),
        ...(signature && { 'X-Signature': signature })
      }
    };
    
    const result = await httpRequest(targetUrl, options, payloadStr);
    
    try {
      const responseBody = JSON.parse(result.body);
      // 判断逻辑：HTTP 200 + (没有code字段 或 code === 0)
      // 兼容标准REST接口和有业务码的接口
      const hasCodeField = responseBody.code !== undefined;
      const success = result.statusCode === 200 && (!hasCodeField || responseBody.code === 0);
      
      return {
        success,
        statusCode: result.statusCode,
        response: responseBody
      };
    } catch {
      // 非JSON响应，只要HTTP 200即视为成功
      return {
        success: result.statusCode === 200,
        statusCode: result.statusCode,
        response: { raw: result.body }
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
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

export const advanceStage = async (taskId: string): Promise<{ stageName: string; isComplete: boolean }> => {
  const stages = await runQuery('SELECT * FROM transcription_stages WHERE task_id = ? ORDER BY created_at', [taskId]);
  const now = new Date().toISOString();
  
  let currentStageName = '';
  let allCompleted = true;

  for (const stage of stages) {
    if (stage.status !== 'completed') {
      allCompleted = false;
    }
    if (stage.status === 'pending' && !currentStageName) {
      await runExecute(
        'UPDATE transcription_stages SET status = ?, started_at = ?, progress = ? WHERE id = ?',
        ['processing', now, 0, stage.id]
      );
      currentStageName = stage.stage_name;
    }
  }

  if (!currentStageName && allCompleted) {
    return { stageName: '', isComplete: true };
  }

  return { stageName: currentStageName, isComplete: false };
};

export const completeStage = async (taskId: string, stageName: string): Promise<void> => {
  const now = new Date().toISOString();
  await runExecute(
    'UPDATE transcription_stages SET status = ?, completed_at = ?, progress = ? WHERE task_id = ? AND stage_name = ?',
    ['completed', now, 100, taskId, stageName]
  );

  const stages = await runQuery('SELECT * FROM transcription_stages WHERE task_id = ?', [taskId]);
  const allCompleted = stages.every((s: any) => s.status === 'completed');
  
  if (allCompleted) {
    await updateTaskStatus(taskId, 'transcribed', 'system', '所有转写阶段已完成');
  }
};

export const updateStageProgress = async (taskId: string, stageName: string, progress: number): Promise<void> => {
  await runExecute(
    'UPDATE transcription_stages SET progress = ? WHERE task_id = ? AND stage_name = ?',
    [Math.min(100, Math.max(0, progress)), taskId, stageName]
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

export const executeCallback = async (taskId: string, useDemoMode = true): Promise<{ success: boolean; response?: any; isDemoMode?: boolean }> => {
  const task = await getTaskDetail(taskId);
  if (!task.callback_target) throw new Error('回调目标不存在');

  const fragments = await runQuery('SELECT * FROM text_fragments WHERE task_id = ?', [taskId]);
  const payload = {
    task_id: taskId,
    status: 'completed',
    audio_url: task.audio_url,
    file_name: task.file_name,
    transcription_result: fragments,
    timestamp: Date.now()
  };

  await runExecute(
    'UPDATE callback_targets SET retry_count = retry_count + 1, last_callback_at = ? WHERE task_id = ?',
    [new Date().toISOString(), taskId]
  );

  const retryCount = task.callback_target.retry_count;

  if (useDemoMode && retryCount < 2) {
    await recordFailure(
      taskId,
      'callback',
      'NETWORK_ERROR',
      '连接超时 - 演示模式自动失败',
      JSON.stringify(payload),
      JSON.stringify({ error: 'timeout', demo_mode: true }),
      'callback_service',
      task.callback_target.id
    );

    await runExecute(
      'UPDATE callback_targets SET status = ?, next_retry_at = ? WHERE task_id = ?',
      ['retrying', new Date(Date.now() + 60000).toISOString(), taskId]
    );

    await updateTaskStatus(taskId, 'callback_failed', 'system', '回调失败，等待重试');

    return { success: false, response: { error: 'timeout', demo_mode: true }, isDemoMode: true };
  }

  const callbackResult = await sendCallbackRequest(
    task.callback_target.target_url,
    payload,
    task.callback_target.secret_key
  );

  if (!callbackResult.success) {
    await recordFailure(
      taskId,
      'callback',
      callbackResult.statusCode ? `HTTP_${callbackResult.statusCode}` : 'CALLBACK_ERROR',
      callbackResult.error || '回调请求失败',
      JSON.stringify(payload),
      JSON.stringify(callbackResult.response || {}),
      'callback_service',
      task.callback_target.id
    );

    await runExecute(
      'UPDATE callback_targets SET status = ?, next_retry_at = ? WHERE task_id = ?',
      ['retrying', new Date(Date.now() + 60000).toISOString(), taskId]
    );

    await updateTaskStatus(taskId, 'callback_failed', 'system', '回调失败，等待重试');

    return { success: false, response: callbackResult };
  }

  await runExecute(
    'UPDATE callback_targets SET status = ? WHERE task_id = ?',
    ['success', taskId]
  );

  const remark = `回调成功，HTTP ${callbackResult.statusCode}，已通知业务系统`;
  await updateTaskStatus(taskId, 'completed', 'system', remark);

  return { success: true, response: callbackResult };
};

export const retryCallback = async (taskId: string, useDemoMode = true): Promise<{ success: boolean; response?: any }> => {
  const task = await getTaskDetail(taskId);
  if (!task.callback_target) throw new Error('回调目标不存在');

  const retryNumber = task.callback_target.retry_count + 1;

  await runExecute(
    `INSERT INTO retry_records (id, task_id, target_id, retry_number, status)
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), taskId, task.callback_target.id, retryNumber, 'processing']
  );

  const result = await executeCallback(taskId, useDemoMode);

  await runExecute(
    'UPDATE retry_records SET status = ?, response_data = ? WHERE task_id = ? AND retry_number = ?',
    [result.success ? 'success' : 'failed', JSON.stringify(result.response), taskId, retryNumber]
  );

  return result;
};

export const getDemoFragments = (): Array<{ speaker: string; start_time: number; end_time: number; content: string; confidence: number }> => {
  return [
    { speaker: '发言人A', start_time: 0, end_time: 5.2, content: '大家好，今天我们来讨论一下产品的新功能。', confidence: 0.95 },
    { speaker: '发言人B', start_time: 6.1, end_time: 12.3, content: '好的，我先介绍一下这次的技术方案。', confidence: 0.92 },
    { speaker: '发言人A', start_time: 13.5, end_time: 18.7, content: '这个方案的性能指标如何？', confidence: 0.94 },
    { speaker: '发言人B', start_time: 19.2, end_time: 25.8, content: '我们做了压力测试，QPS可以达到1000以上。', confidence: 0.91 },
    { speaker: '发言人C', start_time: 26.5, end_time: 32.1, content: '安全性方面有什么保障措施？', confidence: 0.93 },
    { speaker: '发言人B', start_time: 33.0, end_time: 40.5, content: '我们使用了JWT认证，接口都有权限校验，数据也做了加密存储。', confidence: 0.90 }
  ];
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
