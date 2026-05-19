const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const deliveryService = require('../services/deliveryService');
const csvService = require('../services/csvService');
const DataMasking = require('../utils/dataMasking');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'delivery-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传CSV文件' });
    }

    const { order_no, supplier, delivery_date, created_by } = req.body;
    
    const result = await csvService.importDeliveryOrder(req.file.path, {
      order_no,
      supplier,
      delivery_date,
      created_by
    });

    res.json({
      success: true,
      data: {
        ...result,
        validationResults: DataMasking.maskDeliveryItemList(result.validationResults)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const status = req.query.status || null;

    const result = await deliveryService.getDeliveryOrders(page, pageSize, status);
    
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
    const order = await deliveryService.getDeliveryOrderById(parseInt(req.params.id));
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: '送货单不存在'
      });
    }

    order.items = DataMasking.maskDeliveryItemList(order.items);

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/items', async (req, res) => {
  try {
    const isValid = req.query.is_valid ? req.query.is_valid === 'true' : null;
    
    const items = await deliveryService.getDeliveryItems(parseInt(req.params.id), isValid);
    
    const maskedItems = DataMasking.maskDeliveryItemList(items);

    res.json({
      success: true,
      data: maskedItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    
    let items = await csvService.exportDeliveryItems(parseInt(req.params.id), format);
    
    if (format === 'json') {
      items = DataMasking.maskDeliveryItemList(items);
      res.json({
        success: true,
        data: items
      });
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=delivery_${req.params.id}.csv`);
      res.send('\uFEFF' + items);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { reviewed_by, approved_item_ids } = req.body;
    
    if (!reviewed_by) {
      return res.status(400).json({
        success: false,
        error: '复核人不能为空'
      });
    }

    const result = await deliveryService.reviewDeliveryOrder(
      parseInt(req.params.id),
      reviewed_by,
      approved_item_ids || []
    );

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

router.post('/items/:itemId/review', async (req, res) => {
  try {
    const { reviewed_by, approved, remark } = req.body;
    
    if (!reviewed_by) {
      return res.status(400).json({
        success: false,
        error: '复核人不能为空'
      });
    }

    const result = await deliveryService.reviewDeliveryItem(
      parseInt(req.params.itemId),
      reviewed_by,
      approved !== false,
      remark || ''
    );

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

router.post('/:id/revalidate', async (req, res) => {
  try {
    const result = await deliveryService.revalidateDeliveryOrder(parseInt(req.params.id));
    
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

router.delete('/:id', async (req, res) => {
  try {
    await deliveryService.deleteDeliveryOrder(parseInt(req.params.id));
    
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await deliveryService.getDeliveryStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
