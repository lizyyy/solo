const idempotencyService = require('../services/idempotencyService');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

const ensureDownloadsDir = () => {
  const downloadsDir = path.join(__dirname, '../../data/downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  return downloadsDir;
};

const createRecord = async (req, res) => {
  try {
    const { idempotencyKey, serviceName, apiEndpoint, requestMethod, requestBody, responseStatus, responseBody } = req.body;
    
    if (!idempotencyKey || !serviceName || !apiEndpoint) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const requestFingerprint = idempotencyService.generateRequestFingerprint(
      requestMethod || 'POST',
      apiEndpoint,
      requestBody,
      req.headers
    );

    const existing = await idempotencyService.findIdempotencyRecord(idempotencyKey);
    
    if (existing) {
      const result = await idempotencyService.handleDuplicateRequest(idempotencyKey, {
        requestFingerprint,
        requestMethod: requestMethod || 'POST',
        requestBody
      });
      return res.status(200).json({
        isDuplicate: true,
        action: result.action,
        reason: result.reason,
        existingResponse: {
          status: result.existingRecord.first_response_status,
          body: result.existingRecord.first_response_body
        }
      });
    }

    const record = await idempotencyService.createIdempotencyRecord({
      idempotencyKey,
      serviceName,
      apiEndpoint,
      requestFingerprint,
      requestMethod: requestMethod || 'POST',
      requestBody,
      responseStatus: responseStatus || 200,
      responseBody: responseBody || { success: true }
    });

    res.status(201).json({
      isDuplicate: false,
      record: {
        id: record.id,
        idempotencyKey,
        status: 'active'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const queryRecords = async (req, res) => {
  try {
    const filters = {
      serviceName: req.query.serviceName,
      status: req.query.status,
      idempotencyKey: req.query.idempotencyKey,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit
    };

    const records = await idempotencyService.queryRecords(filters);
    res.status(200).json({ records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getRecordDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const detail = await idempotencyService.getRecordDetail(id);
    
    if (!detail) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.status(200).json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateRecordStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, actor } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await idempotencyService.updateRecordStatus(
      id,
      status,
      reason || '',
      actor || 'admin'
    );
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStatistics = async (req, res) => {
  try {
    const stats = await idempotencyService.getStatistics();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const cleanupExpired = async (req, res) => {
  try {
    const result = await idempotencyService.cleanupExpiredRecords();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const exportRecords = async (req, res) => {
  try {
    const filters = {
      serviceName: req.query.serviceName,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const records = await idempotencyService.queryRecords(filters);
    const downloadsDir = ensureDownloadsDir();
    const filename = `idempotency-audit-${Date.now()}.csv`;
    const filePath = path.join(downloadsDir, filename);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'idempotency_key', title: 'Idempotency Key' },
        { id: 'service_name', title: 'Service Name' },
        { id: 'api_endpoint', title: 'API Endpoint' },
        { id: 'request_method', title: 'Method' },
        { id: 'status', title: 'Status' },
        { id: 'request_count', title: 'Request Count' },
        { id: 'first_request_at', title: 'First Request' },
        { id: 'last_request_at', title: 'Last Request' },
        { id: 'conflict_reason', title: 'Conflict Reason' },
        { id: 'expires_at', title: 'Expires At' }
      ]
    });

    await csvWriter.writeRecords(records);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const batchImport = async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Invalid records data' });
    }

    const results = await idempotencyService.batchImport(records);
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const simulateRequest = async (req, res) => {
  try {
    const { idempotencyKey, serviceName, apiEndpoint, requestMethod, requestBody } = req.body;
    
    const requestFingerprint = idempotencyService.generateRequestFingerprint(
      requestMethod || 'POST',
      apiEndpoint,
      requestBody,
      req.headers
    );

    const existing = await idempotencyService.findIdempotencyRecord(idempotencyKey);
    
    if (existing) {
      const result = await idempotencyService.handleDuplicateRequest(idempotencyKey, {
        requestFingerprint,
        requestMethod: requestMethod || 'POST',
        requestBody
      });
      
      return res.status(200).json({
        type: result.action === 'conflict' ? 'CONFLICT' : 'REUSE',
        message: result.action === 'conflict' 
          ? '请求指纹不匹配，幂等冲突' 
          : '复用首次响应结果',
        fingerprint: {
          existing: existing.request_fingerprint,
          current: requestFingerprint,
          match: result.action !== 'conflict'
        },
        firstResponse: {
          status: existing.first_response_status,
          body: existing.first_response_body
        },
        requestCount: existing.request_count + 1
      });
    }

    const mockResponse = {
      orderId: `ORD-${Date.now()}`,
      amount: Math.floor(Math.random() * 10000) + 100,
      status: 'success',
      timestamp: new Date().toISOString()
    };

    await idempotencyService.createIdempotencyRecord({
      idempotencyKey,
      serviceName,
      apiEndpoint,
      requestFingerprint,
      requestMethod: requestMethod || 'POST',
      requestBody,
      responseStatus: 200,
      responseBody: mockResponse
    });

    res.status(200).json({
      type: 'FIRST',
      message: '首次请求，创建新的幂等记录',
      fingerprint: requestFingerprint,
      response: mockResponse
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createRecord,
  queryRecords,
  getRecordDetail,
  updateRecordStatus,
  getStatistics,
  cleanupExpired,
  exportRecords,
  batchImport,
  simulateRequest
};
