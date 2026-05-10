const { v4: uuidv4 } = require('uuid');

const KEY_STATUS = {
  REGISTERED: 'registered',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  REVOKED: 'revoked',
  EXPIRED: 'expired'
};

const DEFAULT_CONFIG = {
  defaultTTL: 300000,
  processingTimeout: 60000,
  maxKeysPerScope: 1000,
  cleanupInterval: 60000,
  maxRetryCount: 3,
  retryDelay: 1000
};

class IdempotentKeyService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.keys = new Map();
    this.events = [];
    this.scopeRules = new Map();
    this.conflictHistory = [];
    this.taskQueue = [];
    this.isProcessingTask = false;
    this.cleanupInterval = null;
  }

  start() {
    this.startCleanupTask();
    this.startTaskProcessor();
    this.log('INFO', '幂等键服务已启动', { config: this.config });
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.log('INFO', '幂等键服务已停止');
  }

  startCleanupTask() {
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.config.cleanupInterval);
  }

  startTaskProcessor() {
    setInterval(() => {
      this.processTaskQueue();
    }, 1000);
  }

  registerKey(request) {
    const {
      key,
      scope = 'default',
      ttl = this.config.defaultTTL,
      requestBody,
      description
    } = request;

    this.log('INFO', `尝试登记幂等键`, { key, scope });

    if (!key) {
      return this.createError('KEY_MISSING', '幂等键不能为空', { key, scope });
    }

    const scopeValidation = this.validateScopeRules(scope, key);
    if (!scopeValidation.success) {
      return scopeValidation;
    }

    const existingKey = this.keys.get(key);

    if (existingKey) {
      return this.handleExistingKey(existingKey, request);
    }

    const newKey = {
      key,
      scope,
      status: KEY_STATUS.REGISTERED,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      ttl,
      requestBody,
      description,
      requestId: uuidv4(),
      history: [{
        event: 'REGISTERED',
        timestamp: Date.now(),
        details: { scope, ttl, description }
      }],
      retryCount: 0,
      lastError: null,
      processingStartedAt: null,
      result: null
    };

    this.keys.set(key, newKey);
    this.addEvent('KEY_REGISTERED', { key, scope, requestId: newKey.requestId });

    this.log('SUCCESS', `幂等键登记成功`, { key, scope, requestId: newKey.requestId });

    return {
      success: true,
      data: {
        key,
        scope,
        status: KEY_STATUS.REGISTERED,
        requestId: newKey.requestId,
        expiresAt: newKey.expiresAt
      }
    };
  }

  handleExistingKey(existingKey, request) {
    const { key, scope } = existingKey;

    this.log('WARN', `幂等键已存在`, {
      key, scope, existingStatus: existingKey.status });

    const now = Date.now();
    const isExpired = now > existingKey.expiresAt;

    if (isExpired) {
      return {
        success: false,
        error: {
          code: 'KEY_EXPIRED',
          message: '幂等键已过期',
          explanation: `幂等键 ${key} 在作用域 ${scope} 下已过期，原登记时间: ${new Date(existingKey.createdAt).toISOString()}，过期时间: ${new Date(existingKey.expiresAt).toISOString()}`
        }
      };
    }

    const conflictRecord = {
      key,
      scope,
      timestamp: now,
      originalStatus: existingKey.status,
      originalRequest: existingKey.requestBody,
      newRequest: request.requestBody,
      explanation: this.generateConflictExplanation(existingKey, request)
    };

    this.conflictHistory.push(conflictRecord);
    this.addEvent('KEY_CONFLICT', conflictRecord);

    return {
      success: false,
      error: {
        code: 'KEY_CONFLICT',
        message: '幂等键冲突',
        explanation: conflictRecord.explanation,
        details: {
          existingStatus: existingKey.status,
          createdAt: existingKey.createdAt,
          history: existingKey.history.slice(-5),
          retryCount: existingKey.retryCount
        }
      }
    };
  }

  generateConflictExplanation(existingKey, newRequest) {
    const { key, scope, status, history } = existingKey;
    const now = Date.now();

    let explanation = `
【冲突分析】\n`;
    explanation += `幂等键: ${key}\n`;
    explanation += `作用域: ${scope}\n`;
    explanation += `当前状态: ${status}\n`;
    explanation += `\n`;
    explanation += `【历史记录】\n`;

    history.forEach((event, index) => {
      explanation += `${index + 1}. ${new Date(event.timestamp).toISOString()} - ${event.event}\n`;
    });

    explanation += `\n`;
    explanation += `【可能原因】\n`;

    switch (status) {
      case KEY_STATUS.PROCESSING:
        explanation += `1. 业务方可能在处理超时后重试，但原请求仍在处理中\n`;
        explanation += `2. 建议: 检查原请求是否真的失败，还是只是响应超时\n`;
        explanation += `3. 如需强制重试，请先撤销原登记\n`;
        break;

      case KEY_STATUS.SUCCESS:
        explanation += `1. 业务方可能重复提交了相同请求\n`;
        explanation += `2. 原请求已成功处理，结果可复用\n`;
        explanation += `3. 如确认需要重新执行，请先撤销原登记\n`;
        break;

      case KEY_STATUS.FAILED:
        explanation += `1. 原请求已失败\n`;
        explanation += `2. 重试次数: ${existingKey.retryCount}/${this.config.maxRetryCount}\n`;
        explanation += `3. 如未超过最大重试次数，可使用重试接口\n`;
        explanation += `4. 如超过最大重试次数，需要先撤销后重新登记\n`;
        break;

      default:
        explanation += `1. 请检查幂等键生成规则是否唯一\n`;
        explanation += `2. 检查是否存在并发问题\n`;
    }

    return explanation;
  }

  startProcessing(key) {
    const keyData = this.keys.get(key);

    if (!keyData) {
      return this.createError('KEY_NOT_FOUND', '幂等键不存在', { key });
    }

    const now = Date.now();

    if (now > keyData.expiresAt) {
      return this.createError('KEY_EXPIRED', '幂等键已过期', { key });
    }

    if (keyData.status === KEY_STATUS.PROCESSING) {
      return {
        success: false,
        error: {
          code: 'ALREADY_PROCESSING',
          message: '请求正在处理中',
          explanation: `幂等键 ${key} 正在处理中，开始时间: ${new Date(keyData.processingStartedAt).toISOString()}，请等待处理完成或撤销后重试`
        }
      };
    }

    keyData.status = KEY_STATUS.PROCESSING;
    keyData.processingStartedAt = now;
    keyData.history.push({
      event: 'PROCESSING_STARTED',
      timestamp: now
    });

    this.addEvent('PROCESSING_STARTED', { key, status: KEY_STATUS.PROCESSING });

    this.log('INFO', `开始处理幂等键`, { key });

    return {
      success: true,
      data: {
        key,
        status: KEY_STATUS.PROCESSING,
        startedAt: now
      }
    };
  }

  completeProcessing(key, result) {
    const keyData = this.keys.get(key);

    if (!keyData) {
      return this.createError('KEY_NOT_FOUND', '幂等键不存在', { key });
    }

    keyData.status = KEY_STATUS.SUCCESS;
    keyData.result = result;
    keyData.history.push({
      event: 'PROCESSING_COMPLETED',
      timestamp: Date.now(),
      result
    });

    this.addEvent('PROCESSING_COMPLETED', { key, status: KEY_STATUS.SUCCESS });

    this.log('SUCCESS', `幂等键处理完成`, { key });

    return {
      success: true,
      data: {
        key,
        status: KEY_STATUS.SUCCESS,
        result
      }
    };
  }

  failProcessing(key, error) {
    const keyData = this.keys.get(key);

    if (!keyData) {
      return this.createError('KEY_NOT_FOUND', '幂等键不存在', { key });
    }

    keyData.status = KEY_STATUS.FAILED;
    keyData.retryCount = (keyData.retryCount || 0) + 1;
    keyData.lastError = error;
    keyData.history.push({
      event: 'PROCESSING_FAILED',
      timestamp: Date.now(),
      error
    });

    this.addEvent('PROCESSING_FAILED', { key, status: KEY_STATUS.FAILED, error });

    this.log('ERROR', `幂等键处理失败`, { key, error, retryCount: keyData.retryCount });

    return {
      success: true,
      data: {
        key,
        status: KEY_STATUS.FAILED,
        retryCount: keyData.retryCount,
        canRetry: keyData.retryCount < this.config.maxRetryCount
      }
    };
  }

  retryProcessing(key) {
    const keyData = this.keys.get(key);

    if (!keyData) {
      return this.createError('KEY_NOT_FOUND', '幂等键不存在', { key });
    }

    if (keyData.status !== KEY_STATUS.FAILED) {
      return this.createError(
        'INVALID_STATUS_FOR_RETRY',
        '只有失败状态的幂等键才能重试',
        { key, currentStatus: keyData.status }
      );
    }

    if (keyData.retryCount >= this.config.maxRetryCount) {
      return {
        success: false,
        error: {
          code: 'MAX_RETRY_EXCEEDED',
          message: '超过最大重试次数',
          explanation: `幂等键 ${key} 已重试 ${keyData.retryCount} 次，超过最大重试次数 ${this.config.maxRetryCount}。如需继续处理，请先撤销原登记后重新创建幂等键。`
        }
      };
    }

    keyData.status = KEY_STATUS.REGISTERED;
    keyData.processingStartedAt = null;
    keyData.lastError = null;
    keyData.history.push({
      event: 'RETRY_SCHEDULED',
      timestamp: Date.now(),
      retryNumber: keyData.retryCount + 1
    });

    this.addEvent('RETRY_SCHEDULED', { key });

    this.log('INFO', `调度重试幂等键`, { key, retryCount: keyData.retryCount + 1 });

    return {
      success: true,
      data: {
        key,
        status: KEY_STATUS.REGISTERED,
        nextRetry: keyData.retryCount + 1,
        maxRetry: this.config.maxRetryCount
      }
    };
  }

  revokeKey(key, reason = '手动撤销') {
    const keyData = this.keys.get(key);

    if (!keyData) {
      return this.createError('KEY_NOT_FOUND', '幂等键不存在', { key });
    }

    const previousStatus = keyData.status;

    keyData.status = KEY_STATUS.REVOKED;
    keyData.history.push({
      event: 'REVOKED',
      timestamp: Date.now(),
      reason,
      previousStatus
    });

    this.addEvent('KEY_REVOKED', { key, reason, previousStatus });

    this.log('WARN', `幂等键已撤销`, { key, reason, previousStatus });

    return {
      success: true,
      data: {
        key,
        status: KEY_STATUS.REVOKED,
        revokedAt: Date.now(),
        reason,
        previousStatus
      }
    };
  }

  getKeyStatus(key) {
    const keyData = this.keys.get(key);

    if (!keyData) {
      return this.createError('KEY_NOT_FOUND', '幂等键不存在', { key });
    }

    return {
      success: true,
      data: {
        ...keyData,
        isExpired: Date.now() > keyData.expiresAt
      }
    };
  }

  queryKeys(filters = {}) {
    const {
      scope,
      status,
      fromTime,
      toTime
    } = filters;

    let results = Array.from(this.keys.values());

    if (scope) {
      results = results.filter(k => k.scope === scope);
    }

    if (status) {
      results = results.filter(k => k.status === status);
    }

    if (fromTime) {
      results = results.filter(k => k.createdAt >= fromTime);
    }

    if (toTime) {
      results = results.filter(k => k.createdAt <= toTime);
    }

    return {
      success: true,
      data: results,
      count: results.length
    };
  }

  getConflictHistory(filters = {}) {
    let results = [...this.conflictHistory];

    if (filters.key) {
      results = results.filter(c => c.key === filters.key);
    }

    if (filters.scope) {
      results = results.filter(c => c.scope === filters.scope);
    }

    return {
      success: true,
      data: results,
      count: results.length
    };
  }

  getEvents(filters = {}) {
    let results = [...this.events];

    if (filters.eventType) {
      results = results.filter(e => e.type === filters.eventType);
    }

    if (filters.key) {
      results = results.filter(e => e.data && e.data.key === filters.key);
    }

    return {
      success: true,
      data: results.slice(-100),
      count: results.length
    };
  }

  setScopeRule(scope, rules) {
    this.scopeRules.set(scope, rules);
    this.addEvent('SCOPE_RULE_SET', { scope, rules });
    this.log('INFO', `设置作用域规则`, { scope, rules });

    return {
      success: true,
      data: { scope, rules }
    };
  }

  getScopeRules() {
    return {
      success: true,
      data: Object.fromEntries(this.scopeRules)
    };
  }

  validateScopeRules(scope, key) {
    const rules = this.scopeRules.get(scope);

    if (!rules) {
      return { success: true };
    }

    const scopeKeys = Array.from(this.keys.values()).filter(k => k.scope === scope);

    if (rules.maxKeys && scopeKeys.length >= rules.maxKeys) {
      return {
        success: false,
        error: {
          code: 'SCOPE_LIMIT_EXCEEDED',
          message: '作用域键数超过限制',
          explanation: `作用域 ${scope} 已达到最大键数限制 ${rules.maxKeys}，请清理过期键或调整限制值`
        }
      };
    }

    return { success: true };
  }

  queueBackgroundTask(task) {
    const taskWithId = {
      ...task,
      id: uuidv4(),
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: task.maxRetries || 3
    };

    this.taskQueue.push(taskWithId);
    this.addEvent('BACKGROUND_TASK_QUEUED', { taskId: taskWithId.id, type: task.type });

    this.log('INFO', `后台任务已入队`, { taskId: taskWithId.id, type: task.type });

    return {
      success: true,
      data: { taskId: taskWithId.id }
    };
  }

  async processTaskQueue() {
    if (this.isProcessingTask || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessingTask = true;

    const task = this.taskQueue.shift();

    try {
      task.status = 'processing';
      this.addEvent('BACKGROUND_TASK_STARTED', { taskId: task.id });
      this.log('INFO', `开始执行后台任务`, { taskId: task.id, type: task.type });

      await this.executeTask(task);

      task.status = 'completed';
      task.completedAt = Date.now();
      this.addEvent('BACKGROUND_TASK_COMPLETED', { taskId: task.id });
      this.log('SUCCESS', `后台任务完成`, { taskId: task.id });

    } catch (error) {
      task.retryCount++;
      task.lastError = error.message;

      if (task.retryCount < task.maxRetries) {
        task.status = 'retrying';
        this.taskQueue.push(task);
        this.addEvent('BACKGROUND_TASK_RETRY', { taskId: task.id, retryCount: task.retryCount });
        this.log('WARN', `后台任务失败，将重试`, { taskId: task.id, retryCount: task.retryCount, error: error.message });
      } else {
        task.status = 'failed';
        task.failedAt = Date.now();
        this.addEvent('BACKGROUND_TASK_FAILED', { taskId: task.id });
        this.log('ERROR', `后台任务失败，已达最大重试次数`, { taskId: task.id, error: error.message });
      }
    } finally {
      this.isProcessingTask = false;
    }
  }

  async executeTask(task) {
    switch (task.type) {
      case 'cleanup':
        return this.cleanupExpiredKeys();
      case 'report':
        return this.generateReport(task.params);
      case 'notify':
        return this.sendNotification(task.params);
      default:
        throw new Error(`未知任务类型: ${task.type}`);
    }
  }

  runCleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, keyData] of this.keys.entries()) {
      if (now > keyData.expiresAt && keyData.status !== KEY_STATUS.EXPIRED) {
        keyData.status = KEY_STATUS.EXPIRED;
        keyData.history.push({
          event: 'EXPIRED',
          timestamp: now
        });
        this.addEvent('KEY_EXPIRED', { key, scope: keyData.scope });
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.log('INFO', `清理过期键`, { count: cleanedCount });
    }
  }

  cleanupExpiredKeys() {
    const now = Date.now();
    const toDelete = [];

    for (const [key, keyData] of this.keys.entries()) {
      if (now > keyData.expiresAt + this.config.defaultTTL) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => {
      this.keys.delete(key);
    });

    this.log('INFO', `深度清理过期键`, { deletedCount: toDelete.length });

    return { cleaned: toDelete.length };
  }

  generateReport(params) {
    const report = {
      generatedAt: Date.now(),
      totalKeys: this.keys.size,
      totalEvents: this.events.length,
      totalConflicts: this.conflictHistory.length,
      ...params
    };

    this.log('INFO', `生成报告`, { report });
    return report;
  }

  sendNotification(params) {
    this.log('INFO', `发送通知`, { params });
    return { sent: true, params };
  }

  getTaskStatus(taskId) {
    const task = this.taskQueue.find(t => t.id === taskId);
    if (!task) {
      return this.createError('TASK_NOT_FOUND', '任务不存在', { taskId });
    }
    return { success: true, data: task };
  }

  createError(code, message, details = {}) {
    this.log('ERROR', message, { code, ...details });
    return {
      success: false,
      error: {
        code,
        message,
        details
      }
    };
  }

  addEvent(type, data) {
    this.events.push({
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      data
    });
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, JSON.stringify(data));
  }

  getStats() {
    return {
      success: true,
      data: {
        totalKeys: this.keys.size,
        totalEvents: this.events.length,
        totalConflicts: this.conflictHistory.length,
        pendingTasks: this.taskQueue.length,
        statusBreakdown: this.getStatusBreakdown()
      }
    };
  }

  getStatusBreakdown() {
    const breakdown = {};
    for (const keyData of this.keys.values()) {
      breakdown[keyData.status] = (breakdown[keyData.status] || 0) + 1;
    }
    return breakdown;
  }
}

module.exports = {
  IdempotentKeyService,
  KEY_STATUS
};
