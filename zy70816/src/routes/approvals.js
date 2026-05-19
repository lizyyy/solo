const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const Approval = require('../models/Approval');
const AuditLog = require('../models/AuditLog');

router.post('/:batch_no/approve', async (req, res) => {
  try {
    const { handler, reason, notes } = req.body;
    const batch = await Batch.findByNo(req.params.batch_no);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    if (batch.is_frozen) {
      return res.status(400).json({ error: '该批次已被冻结，请先解冻后再审批' });
    }

    const previous_status = batch.status;

    await Approval.create({
      batch_id: batch.id,
      action: '放行',
      status: 'approved',
      reason: reason || '质量检查通过',
      handler: handler || '系统',
      notes,
      previous_status
    });

    await Batch.updateStatus(req.params.batch_no, 'approved');

    await AuditLog.create({
      batch_id: batch.id,
      action: '审批通过',
      old_value: JSON.stringify({ status: previous_status }),
      new_value: JSON.stringify({ status: 'approved' }),
      operator: handler || '系统',
      ip_address: req.ip
    });

    res.json({ message: '批次已放行', batch_no: req.params.batch_no });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:batch_no/reject', async (req, res) => {
  try {
    const { handler, reason, notes } = req.body;
    const batch = await Batch.findByNo(req.params.batch_no);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const previous_status = batch.status;

    await Approval.create({
      batch_id: batch.id,
      action: '退回修改',
      status: 'rejected',
      reason: reason || '需要补充资料',
      handler: handler || '系统',
      notes,
      previous_status
    });

    await Batch.updateStatus(req.params.batch_no, 'rejected');

    await AuditLog.create({
      batch_id: batch.id,
      action: '退回修改',
      old_value: JSON.stringify({ status: previous_status }),
      new_value: JSON.stringify({ status: 'rejected' }),
      operator: handler || '系统',
      ip_address: req.ip
    });

    res.json({ message: '批次已退回修改', batch_no: req.params.batch_no });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:batch_no/process', async (req, res) => {
  try {
    const { handler, reason, notes } = req.body;
    const batch = await Batch.findByNo(req.params.batch_no);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const previous_status = batch.status;

    await Approval.create({
      batch_id: batch.id,
      action: '标记处理中',
      status: 'processing',
      reason: reason || '正在处理中',
      handler: handler || '系统',
      notes,
      previous_status
    });

    await Batch.updateStatus(req.params.batch_no, 'processing');

    await AuditLog.create({
      batch_id: batch.id,
      action: '标记处理',
      old_value: JSON.stringify({ status: previous_status }),
      new_value: JSON.stringify({ status: 'processing' }),
      operator: handler || '系统',
      ip_address: req.ip
    });

    res.json({ message: '批次已标记为处理中', batch_no: req.params.batch_no });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:batch_no/recall', async (req, res) => {
  try {
    const { handler, reason, notes } = req.body;
    const batch = await Batch.findByNo(req.params.batch_no);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const previous_status = batch.status;

    await Approval.create({
      batch_id: batch.id,
      action: '召回处理',
      status: 'recalled',
      reason: reason || '产品召回',
      handler: handler || '系统',
      notes,
      previous_status
    });

    await Batch.updateStatus(req.params.batch_no, 'recalled');

    await AuditLog.create({
      batch_id: batch.id,
      action: '召回处理',
      old_value: JSON.stringify({ status: previous_status }),
      new_value: JSON.stringify({ status: 'recalled' }),
      operator: handler || '系统',
      ip_address: req.ip
    });

    res.json({ message: '批次已标记为召回', batch_no: req.params.batch_no });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, handler } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (handler) filters.handler = handler;

    const approvals = await Approval.findAll(filters);
    res.json(approvals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batch/:batch_no', async (req, res) => {
  try {
    const batch = await Batch.findByNo(req.params.batch_no);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const approvals = await Approval.findByBatchId(batch.id);
    res.json(approvals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
