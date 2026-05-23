const express = require('express');
const router = express.Router();
const processingRecordService = require('../services/processingRecordService');

router.get('/', async (req, res) => {
  try {
    const records = await processingRecordService.getAllRecords(req.query);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await processingRecordService.getRecord(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: '处理记录不存在' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reference/:referenceType/:referenceId', async (req, res) => {
  try {
    const records = await processingRecordService.getRecordsByReference(
      req.params.referenceId,
      req.params.referenceType
    );
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
