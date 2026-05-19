const express = require('express');
const router = express.Router();
const multer = require('multer');
const orderService = require('../services/orderService');
const batchService = require('../services/batchService');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const result = await orderService.importOrdersFromCSV(req.file.buffer, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      has_exception: req.query.has_exception !== undefined ? req.query.has_exception === 'true' : undefined,
      status: req.query.status,
      group_leader_id: req.query.group_leader_id
    };
    const orders = await orderService.getOrders(filters);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await orderService.getOrderDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: '订单不存在' });
    }
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/detect-stock', async (req, res) => {
  try {
    const hasIssue = await orderService.detectStockIssues(req.params.id, req.body.stockInfo);
    res.json({ hasIssue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
