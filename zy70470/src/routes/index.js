const express = require('express');
const router = express.Router();
const store = require('../models/Store');
const OutputFormatter = require('../services/OutputFormatter');

router.get('/', (req, res) => {
  res.json({
    service: 'circuit-breaker-manual-api',
    version: '1.0.0',
    endpoints: {
      'GET /api/records': '获取所有熔断记录',
      'GET /api/records/:id': '获取单个熔断记录详情',
      'GET /api/records/:id/cleanup-list': '生成清理/回滚候选清单',
      'GET /api/records/:id/export/:format': '导出记录 (json, md)',
      'POST /api/records': '创建新熔断记录',
      'POST /api/records/:id/candidate-actions': '添加候选处理动作',
      'POST /api/records/:id/approve-action/:actionId': '批准动作',
      'POST /api/records/:id/manual-corrections': '添加人工修正'
    }
  });
});

router.get('/records', (req, res) => {
  const records = store.getAllRecords();
  const format = req.query.format;
  
  if (format === 'json' || !format) {
    res.json(OutputFormatter.toJSON(records));
  } else if (format === 'md' || format === 'markdown') {
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.send(OutputFormatter.toMarkdown(records));
  } else {
    res.status(400).json({ error: '不支持的输出格式' });
  }
});

router.get('/records/:id', (req, res) => {
  const record = store.getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const format = req.query.format;
  if (format === 'json' || !format) {
    res.json(OutputFormatter.toJSON(record));
  } else if (format === 'md' || format === 'markdown') {
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.send(OutputFormatter.toMarkdown(record));
  } else {
    res.status(400).json({ error: '不支持的输出格式' });
  }
});

router.get('/records/:id/cleanup-list', (req, res) => {
  const cleanupList = store.generateCandidateCleanupList(req.params.id);
  if (!cleanupList) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(cleanupList);
});

router.get('/records/:id/export/:format', (req, res) => {
  const { id, format } = req.params;
  const record = store.getRecordById(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const filename = OutputFormatter.generateDownloadFilename(record, format);
  
  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(OutputFormatter.toJSON(record));
  } else if (format === 'md' || format === 'markdown') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(OutputFormatter.toMarkdown(record));
  } else {
    res.status(400).json({ error: '不支持的导出格式' });
  }
});

router.post('/records', (req, res) => {
  try {
    const record = store.createRecord(req.body);
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/records/:id/candidate-actions', (req, res) => {
  const record = store.addCandidateAction(req.params.id, req.body);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(record);
});

router.post('/records/:id/approve-action/:actionId', (req, res) => {
  const { approver, remark } = req.body;
  if (!approver) {
    return res.status(400).json({ error: '批准人不能为空' });
  }
  
  const record = store.approveAction(req.params.id, req.params.actionId, approver, remark || '');
  if (!record) {
    return res.status(404).json({ error: '记录或动作不存在' });
  }
  res.json(record);
});

router.post('/records/:id/manual-corrections', (req, res) => {
  const { fieldPath, oldValue, newValue, correctedBy, reason, sourceEvidence } = req.body;
  
  if (!fieldPath || !correctedBy || !reason) {
    return res.status(400).json({ error: '字段路径、修正人、修正原因为必填项' });
  }
  
  const record = store.addManualCorrection(req.params.id, {
    fieldPath,
    oldValue,
    newValue,
    correctedBy,
    reason,
    sourceEvidence
  });
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(record);
});

module.exports = router;