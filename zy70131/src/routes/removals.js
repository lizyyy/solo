const express = require('express');
const router = express.Router();
const RemovalService = require('../services/RemovalService');

router.get('/', async (req, res) => {
  try {
    const { materialId, channelId, reason, status, limit = 50, offset = 0 } = req.query;
    const removalService = new RemovalService();

    const filters = {};
    if (materialId) filters.materialId = materialId;
    if (channelId) filters.channelId = channelId;
    if (reason) filters.reason = reason;
    if (status) filters.status = status;

    const records = await removalService.getRemovalRecords(filters, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/process-expired', async (req, res) => {
  try {
    const removalService = new RemovalService();
    const result = await removalService.processExpiredRemovals();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const removalService = new RemovalService();
    const detail = await removalService.getRemovalDetail(req.params.id);

    if (!detail) {
      return res.status(404).json({
        success: false,
        error: '下架记录不存在'
      });
    }

    res.json({
      success: true,
      data: detail
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
