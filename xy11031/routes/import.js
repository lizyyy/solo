const express = require('express');
const router = express.Router();
const importService = require('../services/importService');
const storage = require('../services/storage');
const { validateStatusTransition } = require('../services/validator');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/json', async (req, res) => {
  try {
    let orders, options;
    
    if (Array.isArray(req.body)) {
      orders = req.body;
      options = {};
    } else {
      orders = req.body.orders;
      options = req.body.options || {};
    }
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: '请求格式错误：请发送订单数组，或包含 orders 字段的对象'
      });
    }

    const result = await importService.importOrders(orders, options);
    
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

router.post('/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传CSV文件'
      });
    }

    const orders = [];
    const fileBuffer = req.file.buffer;
    const stream = Readable.from(fileBuffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          orders.push(data);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const result = await importService.importOrders(orders, req.body.options || {});
    
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

router.get('/batches', async (req, res) => {
  try {
    const batches = await importService.getAllBatches();
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/batches/:batchId', async (req, res) => {
  try {
    const batch = await importService.getImportBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      });
    }
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/review/:orderId', async (req, res) => {
  try {
    const { action, remark, operator } = req.body;
    
    if (!['approve', 'reject', 'adjust_and_continue'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'action 必须是 approve, reject 或 adjust_and_continue'
      });
    }

    if (!remark || !operator) {
      return res.status(400).json({
        success: false,
        error: 'remark 和 operator 是必填字段'
      });
    }

    const result = await importService.processManualReview(
      req.params.orderId,
      action,
      remark,
      operator
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/review/pending', async (req, res) => {
  try {
    const pendingOrders = storage.getOrdersNeedingReview();
    res.json({
      success: true,
      data: pendingOrders.map(o => o.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const { status, technicianId, scheduledDate } = req.query;
    let orders = storage.getAllOrders();
    
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    if (technicianId) {
      orders = orders.filter(o => o.technicianId === technicianId);
    }
    if (scheduledDate) {
      orders = orders.filter(o => o.scheduledDate === scheduledDate);
    }
    
    res.json({
      success: true,
      data: orders.map(o => o.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = storage.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: '订单不存在'
      });
    }
    res.json({
      success: true,
      data: order.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/orders/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = storage.getOrderById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: '订单不存在'
      });
    }

    const transitionCheck = validateStatusTransition(order.status, status);
    if (!transitionCheck.valid) {
      return res.status(400).json({
        success: false,
        error: transitionCheck.reason,
        suggestion: transitionCheck.suggestion
      });
    }

    const updatedOrder = storage.updateOrder(req.params.orderId, { status });
    res.json({
      success: true,
      data: updatedOrder.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
