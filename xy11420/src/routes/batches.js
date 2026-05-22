const express = require('express');
const batchModel = require('../models/batch');
const attachmentModel = require('../models/attachment');
const dirtyRecordModel = require('../models/dirtyRecord');
const statusMachine = require('../services/statusMachine');
const { requirePermission, filterFieldsByRole } = require('../middleware/auth');
const { getBatchDetails } = require('../models/batch');
const { all } = require('../db');

const router = express.Router();

router.get('/', requirePermission('view_batch'), (req, res) => {
  try {
    const { page = 1, pageSize = 20, vin, status, plate_number } = req.query;
    
    const result = batchModel.listBatches(
      { vin, status, plate_number },
      parseInt(page),
      parseInt(pageSize)
    );
    
    result.items = filterFieldsByRole(result.items, req.user.role);
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('create_batch'), (req, res) => {
  try {
    const { vin, plate_number, car_model, batch_no, responsible_person } = req.body;
    
    if (!vin) {
      return res.status(400).json({ error: 'VIN码不能为空' });
    }
    
    const batch = batchModel.createBatch(
      { vin, plate_number, car_model, batch_no, responsible_person },
      req.user.userId
    );
    
    res.status(201).json({ batchId: batch.id, ...batch });
  } catch (err) {
    console.error('创建批次错误:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.get('/:id', requirePermission('view_batch'), (req, res) => {
  try {
    const details = getBatchDetails(req.params.id);
    
    if (!details) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    details.batch = filterFieldsByRole(details.batch, req.user.role);
    
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', requirePermission('view_history'), (req, res) => {
  try {
    const history = batchModel.getBatchHistory(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/transitions', (req, res) => {
  try {
    const batch = batchModel.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    const transitions = statusMachine.getAvailableTransitions(batch.status, req.user.role);
    
    res.json({
      currentStatus: batch.status,
      availableTransitions: transitions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/submit', requirePermission('submit_batch'), (req, res) => {
  try {
    const result = statusMachine.submitBatch(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/review/start', requirePermission('review_approve'), (req, res) => {
  try {
    const result = statusMachine.startReview(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/review/approve', requirePermission('review_approve'), (req, res) => {
  try {
    const { reason } = req.body;
    const result = statusMachine.approveBatch(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/review/reject', requirePermission('review_reject'), (req, res) => {
  try {
    const { reason } = req.body;
    const result = statusMachine.rejectBatch(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/freeze', requirePermission('freeze_batch'), (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: '冻结原因不能为空' });
    }
    
    const result = statusMachine.freezeBatch(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/unfreeze', requirePermission('freeze_batch'), (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: '解冻原因不能为空' });
    }
    
    const result = statusMachine.unfreezeBatch(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/archive', requirePermission('archive_batch'), (req, res) => {
  try {
    const { reason } = req.body;
    const result = statusMachine.archiveBatch(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/cancel', requirePermission('cancel_batch'), (req, res) => {
  try {
    const { reason } = req.body;
    const result = statusMachine.cancelBatch(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/settle', requirePermission('settle_batch'), (req, res) => {
  try {
    const { reason } = req.body;
    const result = statusMachine.settleBatch(
      parseInt(req.params.id),
      req.user.userId,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/return', requirePermission('create_batch'), (req, res) => {
  try {
    const result = batchModel.addReturnRecord(
      parseInt(req.params.id),
      req.body,
      req.user.userId
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/inspections', requirePermission('upload_attachment'), (req, res) => {
  try {
    const batch = batchModel.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    const existing = all(
      'SELECT * FROM inspection_orders WHERE batch_id = ?',
      [req.params.id]
    );
    
    const errors = dirtyRecordModel.validateInspectionData(req.body, existing);
    if (errors.length > 0) {
      dirtyRecordModel.createBatchDirtyRecords(parseInt(req.params.id), errors);
    }
    
    const result = attachmentModel.addInspectionOrder(parseInt(req.params.id), req.body);
    res.status(201).json({
      ...result,
      dirty: errors.length > 0,
      dirtyCount: errors.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/quotes', requirePermission('upload_attachment'), (req, res) => {
  try {
    const batch = batchModel.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    const existing = all(
      'SELECT * FROM repair_quotes WHERE batch_id = ?',
      [req.params.id]
    );
    
    const errors = dirtyRecordModel.validateRepairQuoteData(req.body, existing);
    if (errors.length > 0) {
      dirtyRecordModel.createBatchDirtyRecords(parseInt(req.params.id), errors);
    }
    
    const result = attachmentModel.addRepairQuote(parseInt(req.params.id), req.body);
    res.status(201).json({
      ...result,
      dirty: errors.length > 0,
      dirtyCount: errors.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/photos', requirePermission('upload_attachment'), (req, res) => {
  try {
    const batch = batchModel.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    const existing = all(
      'SELECT * FROM photo_lists WHERE batch_id = ?',
      [req.params.id]
    );
    
    const errors = dirtyRecordModel.validatePhotoData(req.body, existing);
    if (errors.length > 0) {
      dirtyRecordModel.createBatchDirtyRecords(parseInt(req.params.id), errors);
    }
    
    const result = attachmentModel.addPhoto(parseInt(req.params.id), req.body);
    res.status(201).json({
      ...result,
      dirty: errors.length > 0,
      dirtyCount: errors.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/scans', requirePermission('upload_attachment'), (req, res) => {
  try {
    const batch = batchModel.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    const existing = all(
      'SELECT * FROM scan_details WHERE batch_id = ?',
      [req.params.id]
    );
    
    const errors = dirtyRecordModel.validateScanData ? dirtyRecordModel.validateScanData(req.body, existing) : [];
    if (errors.length > 0) {
      dirtyRecordModel.createBatchDirtyRecords(parseInt(req.params.id), errors);
    }
    
    const result = attachmentModel.addScanDetail(parseInt(req.params.id), req.body);
    res.status(201).json({
      ...result,
      dirty: errors.length > 0,
      dirtyCount: errors.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
