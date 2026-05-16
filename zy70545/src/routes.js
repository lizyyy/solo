const express = require('express');
const router = express.Router();
const store = require('./store');
const { ImportStatus, ConflictType } = require('./models');

const validateRequired = (body, fields) => {
  const missing = fields.filter(f => !body[f]);
  if (missing.length > 0) {
    return { valid: false, message: `缺少必填字段: ${missing.join(', ')}` };
  }
  return { valid: true };
};

router.post('/batches', (req, res) => {
  const validation = validateRequired(req.body, ['operator', 'source', 'fileName', 'fileHash', 'totalRows']);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const { batch, isNew } = store.createBatch(req.body);

  if (req.body.rows && Array.isArray(req.body.rows)) {
    const rowsData = req.body.rows.map((row, index) => ({
      batchId: batch.id,
      rowNumber: index + 1,
      rawData: row,
      checksum: store.computeHash(row)
    }));
    store.addOriginalRows(rowsData);
  }

  res.status(isNew ? 201 : 200).json({
    isNew,
    batchId: batch.id,
    status: batch.status,
    message: isNew ? '批次创建成功' : '批次已存在，返回已有批次'
  });
});

router.get('/batches', (req, res) => {
  const filters = {
    status: req.query.status,
    operator: req.query.operator
  };
  const batches = store.listBatches(filters);
  res.json(batches);
});

router.get('/batches/:batchId', (req, res) => {
  const batch = store.getBatch(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  res.json(batch);
});

router.patch('/batches/:batchId/status', (req, res) => {
  const validation = validateRequired(req.body, ['status', 'operator']);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  if (!Object.values(ImportStatus).includes(req.body.status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }

  const batch = store.updateBatchStatus(
    req.params.batchId,
    req.body.status,
    req.body.operator,
    req.body.note
  );

  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  res.json({
    batchId: batch.id,
    status: batch.status,
    message: '状态更新成功'
  });
});

router.get('/batches/:batchId/rows', (req, res) => {
  const rows = store.getOriginalRowsByBatch(req.params.batchId);
  res.json(rows);
});

router.get('/batches/:batchId/rows/:rowId', (req, res) => {
  const row = store.getOriginalRow(req.params.rowId);
  if (!row) {
    return res.status(404).json({ error: '行不存在' });
  }

  const corrections = store.getCorrectionsByRow(req.params.rowId);
  const conflicts = store.getConflictsByRow(req.params.rowId);
  const processed = store.getProcessedRowByRowId(req.params.rowId);

  res.json({
    row,
    corrections,
    conflicts,
    processed
  });
});

router.post('/batches/:batchId/rows/:rowId/correct', (req, res) => {
  const validation = validateRequired(req.body, ['fieldName', 'oldValue', 'newValue', 'operator', 'reason']);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const row = store.getOriginalRow(req.params.rowId);
  if (!row) {
    return res.status(404).json({ error: '行不存在' });
  }

  const correction = store.addCorrection({
    rowId: req.params.rowId,
    ...req.body
  });

  res.status(201).json({
    correctionId: correction.id,
    message: '修正记录已添加'
  });
});

router.post('/batches/:batchId/conflicts', (req, res) => {
  const validation = validateRequired(req.body, ['rowId', 'type', 'fieldName', 'message']);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  if (!Object.values(ConflictType).includes(req.body.type)) {
    return res.status(400).json({ error: '无效的冲突类型' });
  }

  const conflict = store.addConflict(req.body);

  res.status(201).json({
    conflictId: conflict.id,
    message: '冲突记录已添加'
  });
});

router.get('/batches/:batchId/conflicts', (req, res) => {
  const conflicts = store.getConflictsByBatch(req.params.batchId);
  res.json(conflicts);
});

router.patch('/conflicts/:conflictId/resolve', (req, res) => {
  const validation = validateRequired(req.body, ['resolution', 'operator']);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const conflict = store.resolveConflict(
    req.params.conflictId,
    req.body.resolution,
    req.body.operator
  );

  if (!conflict) {
    return res.status(404).json({ error: '冲突不存在' });
  }

  res.json({
    conflictId: conflict.id,
    resolution: conflict.resolution,
    message: '冲突已裁决'
  });
});

router.post('/batches/:batchId/process', (req, res) => {
  const validation = validateRequired(req.body, ['operator']);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const rows = store.getOriginalRowsByBatch(req.params.batchId);
  const results = [];

  rows.forEach(row => {
    const corrections = store.getCorrectionsByRow(row.id);
    const finalData = { ...row.rawData };

    corrections.forEach(c => {
      finalData[c.fieldName] = c.newValue;
    });

    const conflicts = store.getConflictsByRow(row.id);
    const unresolvedConflicts = conflicts.filter(c => c.resolution === 'PENDING');
    const success = unresolvedConflicts.length === 0;

    const processed = store.addProcessedRow({
      rowId: row.id,
      finalData,
      success,
      errors: unresolvedConflicts.map(c => c.message)
    });

    store.updateRowStatus(row.id, success ? 'SUCCESS' : 'FAILED');
    results.push({ rowId: row.id, success });
  });

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  let finalStatus = ImportStatus.COMPLETED;
  if (failedCount > 0) {
    finalStatus = failedCount === rows.length ? ImportStatus.FAILED : ImportStatus.NEEDS_REVIEW;
  }

  store.updateBatchStatus(
    req.params.batchId,
    finalStatus,
    req.body.operator,
    `处理完成: 成功${successCount}条, 失败${failedCount}条`
  );

  res.json({
    batchId: req.params.batchId,
    status: finalStatus,
    processed: results.length,
    success: successCount,
    failed: failedCount,
    message: '批次处理完成'
  });
});

router.get('/batches/:batchId/report', (req, res) => {
  const report = store.generateReport(req.params.batchId);
  if (!report) {
    return res.status(404).json({ error: '批次不存在' });
  }

  if (req.query.export === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="audit-report-${req.params.batchId}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(report, null, 2));
  }

  res.json(report);
});

router.get('/batches/:batchId/corrections', (req, res) => {
  const corrections = store.getCorrectionsByBatch(req.params.batchId);
  res.json(corrections);
});

module.exports = router;
