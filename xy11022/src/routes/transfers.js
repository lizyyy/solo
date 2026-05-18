const express = require('express');
const router = express.Router();
const transferService = require('../services/transferService');
const { Parser } = require('json2csv');

router.post('/', async (req, res) => {
  const result = await transferService.createTransfer(req.body);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.patch('/:id', async (req, res) => {
  const result = await transferService.updateTransfer(req.params.id, req.body);
  if (result.success) {
    res.json(result);
  } else if (result.error === '转让记录不存在') {
    res.status(404).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/:id', async (req, res) => {
  const transfer = await transferService.getTransferById(req.params.id);
  if (transfer) {
    res.json({ success: true, data: transfer });
  } else {
    res.status(404).json({ success: false, error: '转让记录不存在' });
  }
});

router.get('/', async (req, res) => {
  const result = await transferService.getTransfers(req.query);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/batch', async (req, res) => {
  const { transfers } = req.body;
  if (!Array.isArray(transfers)) {
    return res.status(400).json({
      success: false,
      error: 'transfers 必须是数组格式'
    });
  }
  const result = await transferService.batchImport(transfers);
  res.json(result);
});

router.get('/export/csv', async (req, res) => {
  const result = await transferService.exportTransfers(req.query);
  if (!result.success) {
    return res.status(400).json(result);
  }

  const fields = [
    'transfer_no', 'transfer_date', 'store_name',
    'assignor_name', 'assignor_phone',
    'assignee_name', 'assignee_phone',
    'coach_name', 'class_package_name',
    'transfer_class_count', 'remaining_class_count',
    'original_unit_price', 'transfer_fee', 'total_amount',
    'scheduled_class_time', 'status', 'handler_name',
    'approved_at', 'reject_reason', 'remark', 'created_at'
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(result.data);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=class_transfers_${Date.now()}.csv`);
  res.send('\uFEFF' + csv);
});

module.exports = router;
