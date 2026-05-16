const { v4: uuidv4 } = require('uuid');
const http = require('http');
const https = require('https');
const { getDatabase, promisifyDb } = require('../../config/database');

const PROCESSING_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  MANUAL_REQUIRED: 'manual_required',
  CANCELLED: 'cancelled'
};

const CALLBACK_TIMEOUT = 10000;

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || CALLBACK_TIMEOUT
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            success: true,
            statusCode: res.statusCode,
            data: data
          });
        } else {
          const error = new Error(`回调返回 ${res.statusCode}`);
          error.statusCode = res.statusCode;
          error.responseData = data;
          reject(error);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('回调请求超时'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

class DlxService {
  constructor() {
    this.db = getDatabase();
    this.pDb = promisifyDb(this.db);
    this.rateLimitStore = new Map();
    this.mockMode = true;
    this.mockResponses = new Map();
  }

  setMockMode(enabled) {
    this.mockMode = enabled;
  }

  setMockResponse(url, response) {
    this.mockResponses.set(url, response);
  }

  clearMockResponses() {
    this.mockResponses.clear();
  }

  async createDlxMessage(eventId, errorTypeId, originalInput, processingEvidence = null) {
    const messageId = uuidv4();
    
    await this.pDb.run(
      `INSERT INTO dlx_messages 
       (id, event_id, error_type_id, status, original_input, processing_evidence)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [messageId, eventId, errorTypeId, PROCESSING_STATUSES.PENDING, 
       JSON.stringify(originalInput), processingEvidence ? JSON.stringify(processingEvidence) : null]
    );
    
    return this.getDlxMessage(messageId);
  }

  async getDlxMessage(messageId) {
    const message = await this.pDb.get(`
      SELECT dm.*, ce.event_type, ce.payload, ce.callback_url, ce.headers as event_headers,
             et.error_code, et.error_name
      FROM dlx_messages dm
      JOIN callback_events ce ON dm.event_id = ce.id
      JOIN error_types et ON dm.error_type_id = et.id
      WHERE dm.id = ?
    `, [messageId]);
    
    if (!message) return null;
    
    return this._formatMessage(message);
  }

  async listDlxMessages(filters = {}, pagination = { page: 1, limit: 20 }) {
    let whereClauses = [];
    let params = [];
    
    if (filters.errorTypeId) {
      whereClauses.push('dm.error_type_id = ?');
      params.push(filters.errorTypeId);
    }
    if (filters.status) {
      whereClauses.push('dm.status = ?');
      params.push(filters.status);
    }
    if (filters.batchId) {
      whereClauses.push('dm.batch_id = ?');
      params.push(filters.batchId);
    }
    
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await this.pDb.get(`
      SELECT COUNT(*) as total
      FROM dlx_messages dm
      ${whereSql}
    `, params);
    
    const total = countResult.total;
    
    const offset = (pagination.page - 1) * pagination.limit;
    const queryParams = [...params, pagination.limit, offset];
    
    const messages = await this.pDb.all(`
      SELECT dm.*, ce.event_type, ce.callback_url, et.error_code, et.error_name
      FROM dlx_messages dm
      JOIN callback_events ce ON dm.event_id = ce.id
      JOIN error_types et ON dm.error_type_id = et.id
      ${whereSql}
      ORDER BY dm.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);
    
    return {
      data: messages.map(m => this._formatMessage(m)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  async groupByErrorType() {
    return await this.pDb.all(`
      SELECT et.id as error_type_id, et.error_code, et.error_name, et.description,
             COUNT(*) as message_count,
             SUM(CASE WHEN dm.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
             SUM(CASE WHEN dm.status = 'processing' THEN 1 ELSE 0 END) as processing_count,
             SUM(CASE WHEN dm.status = 'success' THEN 1 ELSE 0 END) as success_count,
             SUM(CASE WHEN dm.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
             SUM(CASE WHEN dm.status = 'manual_required' THEN 1 ELSE 0 END) as manual_required_count
      FROM dlx_messages dm
      JOIN error_types et ON dm.error_type_id = et.id
      GROUP BY et.id, et.error_code, et.error_name
      ORDER BY message_count DESC
    `);
  }

  async createBatch(batchName, errorTypeId, strategyId, createdBy = null) {
    const batchId = uuidv4();
    
    const pendingMessages = await this.pDb.all(`
      SELECT id FROM dlx_messages 
      WHERE error_type_id = ? AND status = 'pending' AND batch_id IS NULL
    `, [errorTypeId]);
    
    const totalCount = pendingMessages.length;
    
    await this.pDb.run(`
      INSERT INTO dlx_batches 
      (id, batch_name, error_type_id, strategy_id, status, total_count, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [batchId, batchName, errorTypeId, strategyId, PROCESSING_STATUSES.PENDING, totalCount, createdBy]);
    
    for (const msg of pendingMessages) {
      await this.pDb.run(`
        UPDATE dlx_messages SET batch_id = ? WHERE id = ?
      `, [batchId, msg.id]);
    }
    
    return this.getBatch(batchId);
  }

  async getBatch(batchId) {
    const batch = await this.pDb.get(`
      SELECT db.*, et.error_code, et.error_name, rs.strategy_code, rs.strategy_name
      FROM dlx_batches db
      JOIN error_types et ON db.error_type_id = et.id
      JOIN retry_strategies rs ON db.strategy_id = rs.id
      WHERE db.id = ?
    `, [batchId]);
    return batch || null;
  }

  async listBatches(filters = {}, pagination = { page: 1, limit: 20 }) {
    let whereClauses = [];
    let params = [];
    
    if (filters.status) {
      whereClauses.push('db.status = ?');
      params.push(filters.status);
    }
    if (filters.errorTypeId) {
      whereClauses.push('db.error_type_id = ?');
      params.push(filters.errorTypeId);
    }
    
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await this.pDb.get(`
      SELECT COUNT(*) as total FROM dlx_batches db ${whereSql}
    `, params);
    
    const total = countResult.total;
    
    const offset = (pagination.page - 1) * pagination.limit;
    const queryParams = [...params, pagination.limit, offset];
    
    const batches = await this.pDb.all(`
      SELECT db.*, et.error_code, et.error_name, rs.strategy_code, rs.strategy_name
      FROM dlx_batches db
      JOIN error_types et ON db.error_type_id = et.id
      JOIN retry_strategies rs ON db.strategy_id = rs.id
      ${whereSql}
      ORDER BY db.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);
    
    return {
      data: batches,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  async startBatch(batchId) {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error('批次不存在');
    if (batch.status !== PROCESSING_STATUSES.PENDING) throw new Error('批次状态不正确');
    
    await this.pDb.run(`
      UPDATE dlx_batches SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [PROCESSING_STATUSES.PROCESSING, batchId]);
    
    await this.pDb.run(`
      UPDATE dlx_messages SET status = ? WHERE batch_id = ? AND status = 'pending'
    `, [PROCESSING_STATUSES.PROCESSING, batchId]);
    
    return this.getBatch(batchId);
  }

  _checkRateLimit(strategy) {
    const now = Date.now();
    const windowStart = now - strategy.rate_limit_window;
    
    if (!this.rateLimitStore.has(strategy.id)) {
      this.rateLimitStore.set(strategy.id, []);
    }
    
    const timestamps = this.rateLimitStore.get(strategy.id);
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    
    if (validTimestamps.length >= strategy.rate_limit) {
      return false;
    }
    
    validTimestamps.push(now);
    this.rateLimitStore.set(strategy.id, validTimestamps);
    return true;
  }

  async processMessage(messageId) {
    const message = await this.getDlxMessage(messageId);
    if (!message) throw new Error('消息不存在');

    if (message.status === PROCESSING_STATUSES.SUCCESS) {
      return message;
    }
    
    const batch = await this.getBatch(message.batchId);
    const strategy = await this.getStrategyById(batch.strategy_id);
    
    if (!this._checkRateLimit(strategy)) {
      throw new Error('触发限流，请稍后重试');
    }
    
    if (message.retryCount >= strategy.max_retries) {
      if (message.status !== PROCESSING_STATUSES.MANUAL_REQUIRED) {
        await this._updateMessageStatus(messageId, PROCESSING_STATUSES.MANUAL_REQUIRED, {
          finalConclusion: '已达到最大重试次数，需要人工介入'
        });
      }
      return this.getDlxMessage(messageId);
    }
    
    const originalRetryCount = message.retryCount;
    let callbackResult;
    
    try {
      callbackResult = await this._executeCallback(message, strategy);
      
      await this._updateMessageStatus(messageId, PROCESSING_STATUSES.SUCCESS, {
        retryCount: originalRetryCount + 1,
        lastRetryAt: new Date().toISOString(),
        finalConclusion: `重试成功，HTTP ${callbackResult.statusCode || 200}`,
        processingEvidence: JSON.stringify({
          attempt: originalRetryCount + 1,
          success: true,
          statusCode: callbackResult.statusCode,
          responseData: callbackResult.data,
          timestamp: new Date().toISOString()
        })
      });
      
      await this._incrementBatchSuccessCount(message.batchId);
      
    } catch (error) {
      const newRetryCount = originalRetryCount + 1;
      
      const errorType = this._classifyError(error);
      const errorEvidence = {
        attempt: newRetryCount,
        success: false,
        errorType: errorType,
        errorMessage: error.message,
        statusCode: error.statusCode,
        timestamp: new Date().toISOString()
      };
      
      if (newRetryCount >= strategy.max_retries) {
        errorEvidence.final = true;
        errorEvidence.action = 'require_manual';
        
        await this._updateMessageStatus(messageId, PROCESSING_STATUSES.MANUAL_REQUIRED, {
          retryCount: newRetryCount,
          lastRetryAt: new Date().toISOString(),
          lastError: error.message,
          finalConclusion: `重试${newRetryCount}次全部失败，需要人工介入`,
          processingEvidence: JSON.stringify(errorEvidence)
        });
        
        await this._incrementBatchFailCount(message.batchId);
      } else {
        await this._updateMessageStatus(messageId, PROCESSING_STATUSES.FAILED, {
          retryCount: newRetryCount,
          lastRetryAt: new Date().toISOString(),
          lastError: error.message,
          processingEvidence: JSON.stringify(errorEvidence)
        });
        
        await this._incrementBatchFailCount(message.batchId);
      }
    }
    
    await this._checkBatchCompletion(message.batchId);
    
    return this.getDlxMessage(messageId);
  }

  async _executeCallback(message, strategy) {
    const input = message.manuallyCorrectedInput || message.originalInput;
    const callbackUrl = input.url || message.callbackUrl;
    const payload = input.payload || {};
    const headers = input.headers || {};
    
    if (this.mockMode) {
      const mockResponse = this.mockResponses.get(callbackUrl);
      if (mockResponse) {
        if (mockResponse.success) {
          return { success: true, statusCode: 200, data: JSON.stringify(mockResponse.data || {}) };
        } else {
          const error = new Error(mockResponse.message || 'Mock callback failed');
          error.statusCode = mockResponse.statusCode || 500;
          throw error;
        }
      }
      return { success: true, statusCode: 200, data: '{}' };
    }
    
    return httpRequest(callbackUrl, {
      method: 'POST',
      headers,
      body: payload,
      timeout: strategy.retry_interval > 0 ? Math.min(strategy.retry_interval, CALLBACK_TIMEOUT) : CALLBACK_TIMEOUT
    });
  }

  _classifyError(error) {
    if (error.message.includes('timeout') || error.message.includes('超时')) {
      return 'timeout';
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET')) {
      return 'network_error';
    }
    if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
      return 'dns_error';
    }
    if (error.statusCode >= 500) {
      return 'server_error';
    }
    if (error.statusCode >= 400) {
      return 'client_error';
    }
    return 'unknown_error';
  }

  async manualCorrect(messageId, correctedInput, operator = null) {
    const message = await this.getDlxMessage(messageId);
    if (!message) throw new Error('消息不存在');
    
    const currentEvidence = message.processingEvidence || {};
    const correctionEvidence = {
      ...currentEvidence,
      correctedBy: operator,
      correctedAt: new Date().toISOString(),
      corrections: Object.keys(correctedInput)
    };
    
    await this.pDb.run(`
      UPDATE dlx_messages 
      SET manually_corrected_input = ?, status = ?, retry_count = 0, processing_evidence = ?
      WHERE id = ?
    `, [
      JSON.stringify(correctedInput), 
      PROCESSING_STATUSES.PENDING,
      JSON.stringify(correctionEvidence),
      messageId
    ]);
    
    return this.getDlxMessage(messageId);
  }

  async retryAfterManualCorrect(messageId) {
    const message = await this.getDlxMessage(messageId);
    if (!message) throw new Error('消息不存在');
    if (message.status !== PROCESSING_STATUSES.PENDING || !message.manuallyCorrectedInput) {
      throw new Error('消息状态不正确或未进行人工修正');
    }
    
    return this.processMessage(messageId);
  }

  async _updateMessageStatus(messageId, status, updates = {}) {
    const currentMessage = await this.getDlxMessage(messageId);
    if (!currentMessage) throw new Error('消息不存在');
    
    if (currentMessage.status === PROCESSING_STATUSES.SUCCESS && status === PROCESSING_STATUSES.SUCCESS) {
      return;
    }
    
    const fields = ['status = ?'];
    const params = [status];
    
    if (updates.retryCount !== undefined) {
      fields.push('retry_count = ?');
      params.push(updates.retryCount);
    }
    if (updates.lastRetryAt) {
      fields.push('last_retry_at = ?');
      params.push(updates.lastRetryAt);
    }
    if (updates.lastError !== undefined) {
      fields.push('last_error = ?');
      params.push(updates.lastError);
    }
    if (updates.processingEvidence) {
      fields.push('processing_evidence = ?');
      params.push(updates.processingEvidence);
    }
    if (updates.finalConclusion) {
      fields.push('final_conclusion = ?');
      params.push(updates.finalConclusion);
    }
    
    params.push(messageId);
    
    await this.pDb.run(`
      UPDATE dlx_messages SET ${fields.join(', ')} WHERE id = ?
    `, params);
  }

  async _incrementBatchSuccessCount(batchId) {
    await this.pDb.run(`
      UPDATE dlx_batches SET success_count = success_count + 1 WHERE id = ?
    `, [batchId]);
  }

  async _incrementBatchFailCount(batchId) {
    await this.pDb.run(`
      UPDATE dlx_batches SET fail_count = fail_count + 1 WHERE id = ?
    `, [batchId]);
  }

  async _checkBatchCompletion(batchId) {
    const batch = await this.getBatch(batchId);
    if (batch.success_count + batch.fail_count >= batch.total_count && batch.status !== PROCESSING_STATUSES.SUCCESS) {
      await this.pDb.run(`
        UPDATE dlx_batches SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [PROCESSING_STATUSES.SUCCESS, batchId]);
    }
  }

  async getStrategyById(strategyId) {
    return await this.pDb.get('SELECT * FROM retry_strategies WHERE id = ?', [strategyId]);
  }

  async listErrorTypes() {
    return await this.pDb.all('SELECT * FROM error_types ORDER BY id');
  }

  async listStrategies() {
    return await this.pDb.all('SELECT * FROM retry_strategies ORDER BY id');
  }

  async generateReport(batchId, reportType = 'summary') {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error('批次不存在');
    
    const messages = await this.pDb.all(`
      SELECT dm.*, ce.event_type, ce.callback_url, et.error_code, et.error_name
      FROM dlx_messages dm
      JOIN callback_events ce ON dm.event_id = ce.id
      JOIN error_types et ON dm.error_type_id = et.id
      WHERE dm.batch_id = ?
    `, [batchId]);
    
    const formattedMessages = messages.map(m => this._formatMessage(m));
    
    const successRate = batch.total_count > 0 ? (batch.success_count / batch.total_count * 100).toFixed(2) : 0;
    const failRate = batch.total_count > 0 ? (batch.fail_count / batch.total_count * 100).toFixed(2) : 0;
    
    const errorBreakdown = {};
    formattedMessages.forEach(m => {
      if (m.lastError) {
        const errorType = m.processingEvidence?.errorType || 'unknown';
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
      }
    });
    
    const reportContent = {
      batch,
      generatedAt: new Date().toISOString(),
      summary: {
        total: batch.total_count,
        success: batch.success_count,
        failed: batch.fail_count,
        successRate,
        failRate
      },
      errorBreakdown,
      messages: formattedMessages
    };
    
    const reportId = uuidv4();
    await this.pDb.run(`
      INSERT INTO retry_reports (id, batch_id, report_type, content)
      VALUES (?, ?, ?, ?)
    `, [reportId, batchId, reportType, JSON.stringify(reportContent)]);
    
    return reportContent;
  }

  async exportMessages(batchId) {
    return await this.pDb.all(`
      SELECT dm.id, dm.status, dm.retry_count, dm.last_error, dm.final_conclusion, dm.created_at, dm.last_retry_at,
             ce.event_type, ce.callback_url,
             et.error_code, et.error_name,
             dm.original_input, dm.manually_corrected_input, dm.processing_evidence
      FROM dlx_messages dm
      JOIN callback_events ce ON dm.event_id = ce.id
      JOIN error_types et ON dm.error_type_id = et.id
      WHERE dm.batch_id = ?
      ORDER BY dm.created_at DESC
    `, [batchId]);
  }

  async createEvent(eventData) {
    const eventId = uuidv4();
    await this.pDb.run(`
      INSERT INTO callback_events (id, event_type, payload, callback_url, headers)
      VALUES (?, ?, ?, ?, ?)
    `, [eventId, eventData.eventType, JSON.stringify(eventData.payload), 
        eventData.callbackUrl, eventData.headers ? JSON.stringify(eventData.headers) : null]);
    
    return await this.pDb.get('SELECT * FROM callback_events WHERE id = ?', [eventId]);
  }

  _formatMessage(msg) {
    return {
      id: msg.id,
      eventId: msg.event_id,
      batchId: msg.batch_id,
      errorTypeId: msg.error_type_id,
      errorCode: msg.error_code,
      errorName: msg.error_name,
      status: msg.status,
      retryCount: msg.retry_count,
      maxRetries: msg.max_retries,
      lastError: msg.last_error,
      lastRetryAt: msg.last_retry_at,
      originalInput: msg.original_input ? JSON.parse(msg.original_input) : null,
      manuallyCorrectedInput: msg.manually_corrected_input ? JSON.parse(msg.manually_corrected_input) : null,
      processingEvidence: msg.processing_evidence ? JSON.parse(msg.processing_evidence) : null,
      finalConclusion: msg.final_conclusion,
      eventType: msg.event_type,
      callbackUrl: msg.callback_url,
      createdAt: msg.created_at
    };
  }
}

module.exports = new DlxService();
module.exports.PROCESSING_STATUSES = PROCESSING_STATUSES;
