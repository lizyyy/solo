const express = require('express');
const router = express.Router();
const { processReceipt, getReceiptsByDevice, getReceiptsByCommand, getReceiptById } = require('../services/receiptService');

router.post('/', (req, res) => {
  const { deviceId, reportedStatus, source, relatedCommandId, operator } = req.body;

  if (!deviceId || !reportedStatus) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数：deviceId 和 reportedStatus',
    });
  }

  const result = processReceipt(deviceId, reportedStatus, { source, relatedCommandId, operator });
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/command/:commandId', (req, res) => {
  const receipts = getReceiptsByCommand(req.params.commandId);
  res.json({ success: true, data: receipts });
});

router.get('/device/:deviceId', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 50;
  const receipts = getReceiptsByDevice(req.params.deviceId, limit);
  res.json({ success: true, data: receipts });
});

router.get('/:id', (req, res) => {
  const receipt = getReceiptById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ success: false, error: '回执不存在' });
  }
  res.json({ success: true, data: receipt });
});

module.exports = router;
