const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { auditMiddleware } = require('../middleware/audit');
const importService = require('../services/importService');
const queryService = require('../services/queryService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.use(auditMiddleware('batch'));

router.get('/', async (req, res) => {
  try {
    const result = await importService.getBatchList(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/items', async (req, res) => {
  try {
    const items = await importService.getBatchItems(req.params.id, req.query);
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import/packages', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传CSV文件' });
    }
    
    const operator = req.headers['x-operator'] || 'system';
    const storeCode = req.body.store_code || 'HQ001';
    
    const result = await importService.importPackagesFromCSV(req.file.path, storeCode, operator);
    
    await req.audit.log('IMPORT_PACKAGES', {
      relation_id: result.batchId,
      relation_code: result.batchNo,
      store_code: storeCode,
      operation_reason: `导入${result.total}条套餐数据`,
      new_value: result
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import/workorders', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传JSON文件' });
    }
    
    const operator = req.headers['x-operator'] || 'system';
    const storeCode = req.body.store_code || 'HQ001';
    
    const result = await importService.importWorkOrdersFromJSON(req.file.path, storeCode, operator);
    
    await req.audit.log('IMPORT_WORKORDERS', {
      relation_id: result.batchId,
      relation_code: result.batchNo,
      store_code: storeCode,
      operation_reason: `导入${result.total}条工单数据`,
      new_value: result
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import/stock', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传CSV文件' });
    }
    
    const operator = req.headers['x-operator'] || 'system';
    const storeCode = req.body.store_code || 'HQ001';
    
    const result = await importService.importStockFromCSV(req.file.path, storeCode, operator);
    
    await req.audit.log('IMPORT_STOCK', {
      relation_id: result.batchId,
      relation_code: result.batchNo,
      store_code: storeCode,
      operation_reason: `导入${result.total}条库存数据`,
      new_value: result
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/items/:id/process', async (req, res) => {
  try {
    const { action, reason, updates, itemType } = req.body;
    const operator = req.headers['x-operator'] || 'system';
    const itemId = req.params.id;
    
    if (!['approve', 'reject', 'return'].includes(action)) {
      return res.status(400).json({ success: false, error: '无效的操作类型' });
    }
    
    let result;
    if (itemType === 'package') {
      result = await importService.processPackageItem(itemId, operator, action, reason);
    } else if (itemType === 'workorder') {
      result = await importService.processWorkOrderItem(itemId, operator, action, reason, updates);
    } else if (itemType === 'stock') {
      result = await importService.processStockItem(itemId, operator, action, reason, updates);
    } else {
      return res.status(400).json({ success: false, error: '无效的数据类型' });
    }
    
    res.json({ success: true, message: '处理成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/export', async (req, res) => {
  try {
    const result = await queryService.exportBatchItems(req.params.id);
    
    await req.audit.log('EXPORT_BATCH', {
      relation_id: parseInt(req.params.id),
      operation_reason: `导出批次数据 ${result.count} 条`,
      new_value: result
    });
    
    res.download(result.filepath, result.filename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
