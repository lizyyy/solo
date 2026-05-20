const express = require('express');
const router = express.Router();
const BusinessService = require('../services/BusinessService');
const TrackingRecordModel = require('../models/TrackingRecordModel');
const BatchModel = require('../models/BatchModel');
const OperationLogModel = require('../models/OperationLogModel');

router.post('/process-transfer', async (req, res) => {
  try {
    const { transfer_id, handler, remarks } = req.body;
    if (!transfer_id) {
      return res.status(400).json({ error: '请提供流转记录ID' });
    }

    const result = await BusinessService.processPatientTransfer(
      transfer_id,
      handler || 'admin',
      remarks
    );

    res.json({
      success: true,
      message: result.issues.length > 0 
        ? '处理完成，存在需审核的问题' 
        : '转科处理完成',
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/check-timeout', async (req, res) => {
  try {
    const timeoutOrders = await BusinessService.checkTimeoutOrders();
    res.json({
      success: true,
      count: timeoutOrders.length,
      data: timeoutOrders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batches/list', async (req, res) => {
  try {
    const batches = await BatchModel.getAll();
    res.json({
      success: true,
      count: batches.length,
      data: batches
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batches/:batch_id/records', async (req, res) => {
  try {
    const { batch_id } = req.params;
    const records = await TrackingRecordModel.findByBatchId(batch_id);
    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      ward: req.query.ward,
      department: req.query.department,
      status: req.query.status,
      record_type: req.query.record_type,
      handler: req.query.handler
    };

    const records = await TrackingRecordModel.getHistory(filters);

    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:record_id', async (req, res) => {
  try {
    const { record_id } = req.params;
    const detail = await BusinessService.getRecordDetail(record_id);

    res.json({
      success: true,
      data: detail
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:record_id/audit-trail', async (req, res) => {
  try {
    const { record_id } = req.params;
    const detail = await BusinessService.getRecordDetail(record_id);

    res.set('Content-Type', 'text/plain');
    res.send(detail.auditTrail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:record_id/approve', async (req, res) => {
  try {
    const { record_id } = req.params;
    const { handler, reason, remarks } = req.body;

    if (!reason) {
      return res.status(400).json({ error: '请提供批准原因' });
    }

    const result = await BusinessService.approveRecord(
      record_id,
      handler || 'admin',
      reason,
      remarks
    );

    res.json({
      success: true,
      message: '记录已批准',
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:record_id/reject', async (req, res) => {
  try {
    const { record_id } = req.params;
    const { handler, reason, remarks } = req.body;

    if (!reason) {
      return res.status(400).json({ error: '请提供驳回原因' });
    }

    const result = await BusinessService.rejectRecord(
      record_id,
      handler || 'admin',
      reason,
      remarks
    );

    res.json({
      success: true,
      message: '记录已驳回',
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:record_id/send-back', async (req, res) => {
  try {
    const { record_id } = req.params;
    const { handler, reason, remarks } = req.body;

    if (!reason) {
      return res.status(400).json({ error: '请提供退回原因' });
    }

    const result = await BusinessService.sendBackForModification(
      record_id,
      handler || 'admin',
      reason,
      remarks
    );

    res.json({
      success: true,
      message: '记录已退回修改',
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
