const express = require('express');
const router = express.Router();
const ExportService = require('../services/ExportService');

router.get('/batches', async (req, res) => {
  try {
    const { status, is_frozen } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (is_frozen !== undefined) filters.is_frozen = is_frozen === 'true';

    const result = await ExportService.exportBatches(filters);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="batches_${Date.now()}.csv"`);
    res.send('\ufeff' + result.csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/approvals/:batch_no', async (req, res) => {
  try {
    const Batch = require('../models/Batch');
    const batch = await Batch.findByNo(req.params.batch_no);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const result = await ExportService.exportApprovalHistory(batch.id);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="approval_${req.params.batch_no}_${Date.now()}.csv"`);
    res.send('\ufeff' + result.csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inventory', async (req, res) => {
  try {
    const { store_id } = req.query;
    const result = await ExportService.exportInventory(store_id ? parseInt(store_id) : null);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventory_${Date.now()}.csv"`);
    res.send('\ufeff' + result.csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const result = await ExportService.exportTransfers();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transfers_${Date.now()}.csv"`);
    res.send('\ufeff' + result.csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
