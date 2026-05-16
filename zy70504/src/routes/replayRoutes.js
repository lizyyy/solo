const express = require('express');
const router = express.Router();
const replayService = require('../services/replayService');
const exportService = require('../services/exportService');
const auditService = require('../services/auditService');
const { desensitizeObject, detectSensitiveFields } = require('../utils/desensitizer');

const getIp = (req) => req.ip || req.connection.remoteAddress || 'unknown';
const getUserAgent = (req) => req.get('User-Agent') || 'unknown';

router.post('/spaces', async (req, res) => {
  try {
    const { namespace, name, description, createdBy, config } = req.body;
    if (!namespace || !name || !createdBy) {
      return res.status(400).json({ error: 'namespace, name, createdBy 为必填字段' });
    }
    
    const result = await replayService.createIsolationSpace(
      namespace, name, description, createdBy, config, getIp(req), getUserAgent(req)
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/spaces', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await replayService.getIsolationSpaces(parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches', async (req, res) => {
  try {
    const { spaceId, namespace, batchName, sourceSystem, createdBy } = req.body;
    if (!spaceId || !namespace || !batchName || !sourceSystem || !createdBy) {
      return res.status(400).json({ error: 'spaceId, namespace, batchName, sourceSystem, createdBy 为必填字段' });
    }
    
    const result = await replayService.createEventBatch(
      spaceId, namespace, batchName, sourceSystem, createdBy, 0, getIp(req), getUserAgent(req)
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches/:batchId/payloads', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { spaceId, namespace, originalEventId, eventType, originalPayload, desensitizedBy, autoDesensitize, desensitizationRules } = req.body;
    
    if (!spaceId || !namespace || !eventType || !originalPayload) {
      return res.status(400).json({ error: 'spaceId, namespace, eventType, originalPayload 为必填字段' });
    }
    
    let finalDesensitizedPayload = req.body.desensitizedPayload;
    let finalRules = desensitizationRules || {};
    
    if (autoDesensitize && !finalDesensitizedPayload) {
      finalRules = detectSensitiveFields(originalPayload);
      finalDesensitizedPayload = desensitizeObject(originalPayload, finalRules);
    }
    
    if (!finalDesensitizedPayload) {
      return res.status(400).json({ error: '需提供 desensitizedPayload 或启用 autoDesensitize' });
    }
    
    const result = await replayService.addDesensitizedPayload(
      batchId, spaceId, namespace, originalEventId, eventType, originalPayload, 
      finalDesensitizedPayload, finalRules, desensitizedBy, getIp(req), getUserAgent(req)
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches/:batchId/state', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { namespace, newState, operatedBy } = req.body;
    
    if (!namespace || !newState || !operatedBy) {
      return res.status(400).json({ error: 'namespace, newState, operatedBy 为必填字段' });
    }
    
    const result = await replayService.advanceReplayState(
      batchId, namespace, newState, operatedBy, getIp(req), getUserAgent(req)
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/batches/:batchId/interceptions', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { spaceId, namespace, payloadId, originalTarget, interceptedTarget, interceptionRules, interceptionStatus, responseData, operatedBy } = req.body;
    
    if (!spaceId || !namespace || !payloadId || !originalTarget || !interceptedTarget || !interceptionStatus) {
      return res.status(400).json({ error: '必填字段缺失' });
    }
    
    const result = await replayService.recordWriteInterception(
      batchId, spaceId, namespace, payloadId, originalTarget, interceptedTarget, 
      interceptionRules, interceptionStatus, responseData, operatedBy
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches/:batchId/exceptions', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { spaceId, namespace, payloadId, exceptionType, errorMessage, errorStack, originalInput, processingEvidence, operatedBy } = req.body;
    
    if (!spaceId || !namespace || !exceptionType || !errorMessage || !originalInput) {
      return res.status(400).json({ error: '必填字段缺失' });
    }
    
    const result = await replayService.recordException(
      batchId, spaceId, namespace, payloadId, exceptionType, errorMessage, 
      errorStack, originalInput, processingEvidence, operatedBy
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches/:batchId/corrections', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { spaceId, namespace, payloadId, exceptionId, correctionType, originalValue, correctedValue, correctionReason, correctedBy } = req.body;
    
    if (!spaceId || !namespace || !correctionType || !correctedValue || !correctionReason || !correctedBy) {
      return res.status(400).json({ error: '必填字段缺失' });
    }
    
    const result = await replayService.createManualCorrection(
      batchId, spaceId, namespace, payloadId, exceptionId, correctionType, 
      originalValue, correctedValue, correctionReason, correctedBy, getIp(req), getUserAgent(req)
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches/:batchId/reviews', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { spaceId, namespace, summaryTitle, summaryContent, rootCause, impactAssessment, correctiveActions, createdBy } = req.body;
    
    if (!spaceId || !namespace || !summaryTitle || !createdBy) {
      return res.status(400).json({ error: 'spaceId, namespace, summaryTitle, createdBy 为必填字段' });
    }
    
    const result = await replayService.createReviewSummary(
      batchId, spaceId, namespace, summaryTitle, summaryContent, rootCause, 
      impactAssessment, correctiveActions, createdBy, getIp(req), getUserAgent(req)
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batches/:batchId/detail', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { namespace } = req.query;
    
    if (!namespace) {
      return res.status(400).json({ error: 'namespace 为必填字段' });
    }
    
    const result = await replayService.getBatchDetail(batchId, namespace);
    if (!result) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batches/:batchId/export-summary', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { namespace } = req.query;
    
    if (!namespace) {
      return res.status(400).json({ error: 'namespace 为必填字段' });
    }
    
    const result = await exportService.getExportSummary(batchId, namespace);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batches/:batchId/export', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { namespace, format = 'json' } = req.query;
    
    if (!namespace) {
      return res.status(400).json({ error: 'namespace 为必填字段' });
    }
    
    const result = await exportService.exportBatchData(batchId, namespace, format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const { namespace, entityType, entityId, limit = 100, offset = 0 } = req.query;
    
    if (!namespace) {
      return res.status(400).json({ error: 'namespace 为必填字段' });
    }
    
    const result = await auditService.getAuditLogs(namespace, entityType, entityId, parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/desensitize', async (req, res) => {
  try {
    const { payload, rules } = req.body;
    
    if (!payload) {
      return res.status(400).json({ error: 'payload 为必填字段' });
    }
    
    const detectedRules = rules || detectSensitiveFields(payload);
    const desensitized = desensitizeObject(payload, detectedRules);
    
    res.json({
      original: payload,
      desensitized,
      rules: detectedRules
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
