const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const Approval = require('../models/Approval');
const AuditLog = require('../models/AuditLog');
const db = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { batch_no, product_id, supplier_id, production_date, expiry_date, quantity, created_by } = req.body;

    if (!batch_no || !product_id || !supplier_id) {
      return res.status(400).json({ error: '批号、产品ID和供应商ID不能为空' });
    }

    const existing = await Batch.findByNo(batch_no);
    if (existing) {
      return res.status(400).json({ error: '该批号已存在' });
    }

    const result = await Batch.create({
      batch_no, product_id, supplier_id, production_date, expiry_date,
      quantity: quantity || 0, created_by: created_by || '系统'
    });

    await AuditLog.create({
      batch_id: result.id,
      action: '创建批次',
      old_value: null,
      new_value: JSON.stringify(result),
      operator: created_by || '系统',
      ip_address: req.ip
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, is_frozen, product_id } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (is_frozen !== undefined) filters.is_frozen = is_frozen === 'true';
    if (product_id) filters.product_id = product_id;

    const batches = await Batch.findAll(filters);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:batch_no', async (req, res) => {
  try {
    const batch = await Batch.findByNo(req.params.batch_no);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:batch_no/freeze', async (req, res) => {
  try {
    const { reason, frozen_by } = req.body;
    const batch = await Batch.findByNo(req.params.batch_no);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    if (batch.is_frozen) {
      return res.status(400).json({ error: '该批次已被冻结' });
    }

    await Batch.freeze(req.params.batch_no, reason || '质量控制冻结', frozen_by || '系统');

    await AuditLog.create({
      batch_id: batch.id,
      action: '冻结批次',
      old_value: JSON.stringify({ is_frozen: false }),
      new_value: JSON.stringify({ is_frozen: true, reason }),
      operator: frozen_by || '系统',
      ip_address: req.ip
    });

    res.json({ message: '批次已冻结', batch_no: req.params.batch_no });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:batch_no/unfreeze', async (req, res) => {
  try {
    const { unfrozen_by } = req.body;
    const batch = await Batch.findByNo(req.params.batch_no);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    if (!batch.is_frozen) {
      return res.status(400).json({ error: '该批次未被冻结' });
    }

    await Batch.unfreeze(req.params.batch_no);

    await AuditLog.create({
      batch_id: batch.id,
      action: '解冻批次',
      old_value: JSON.stringify({ is_frozen: true }),
      new_value: JSON.stringify({ is_frozen: false }),
      operator: unfrozen_by || '系统',
      ip_address: req.ip
    });

    res.json({ message: '批次已解冻', batch_no: req.params.batch_no });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/alerts/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const batches = await Batch.getExpiringBatches(days);
    res.json({ count: batches.length, batches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:batch_no/history', async (req, res) => {
  try {
    const batch = await Batch.findByNo(req.params.batch_no);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const approvals = await Approval.getApprovalHistory(batch.id);
    const auditLogs = await AuditLog.findByBatchId(batch.id);

    res.json({
      batch,
      approval_history: approvals,
      audit_logs: auditLogs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
