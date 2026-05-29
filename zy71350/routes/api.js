const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const importService = require('../services/importService');
const settlementService = require('../services/settlementService');
const batchDao = require('../dao/batchDao');
const itemDao = require('../dao/itemDao');
const artistDao = require('../dao/artistDao');
const exportDao = require('../dao/exportDao');
const authDao = require('../dao/authDao');
const logDao = require('../dao/logDao');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.UPLOAD_DIR)) {
      fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
    }
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}_${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gallery-consignment-settlement', version: '1.0.0' });
});

router.get('/artists', (req, res) => {
  try {
    const artists = artistDao.getAllArtists();
    res.json({ success: true, data: artists });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/import/json', (req, res) => {
  try {
    const { data, settlement_month, remarks } = req.body;
    
    if (!data) {
      return res.status(400).json({ success: false, error: '缺少数据' });
    }
    if (!settlement_month) {
      return res.status(400).json({ success: false, error: '缺少结算月份' });
    }

    const result = importService.importFromJSON(data, settlement_month, 'API_JSON', remarks);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    const { settlement_month, remarks } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    if (!settlement_month) {
      return res.status(400).json({ success: false, error: '缺少结算月份' });
    }

    const result = await importService.importFromCSV(
      req.file.path,
      settlement_month,
      req.file.originalname,
      remarks
    );
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/batches', (req, res) => {
  try {
    const batches = batchDao.listBatches();
    res.json({ success: true, data: batches });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/batches/:batchId', (req, res) => {
  try {
    const batch = batchDao.getBatchById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    
    const stats = batchDao.getBatchStats(req.params.batchId);
    const items = itemDao.getItemsByBatch(req.params.batchId);
    
    res.json({ 
      success: true, 
      data: {
        batch,
        stats,
        items
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/batches/:batchId/issues', (req, res) => {
  try {
    const items = itemDao.getItemsByBatchWithIssues(req.params.batchId);
    const logs = logDao.getLogsByBatch(req.params.batchId);
    
    const issues = items.map(item => {
      const itemLogs = logs.filter(l => l.item_id === item.id && l.severity !== 'info');
      return {
        item,
        issues: itemLogs
      };
    });
    
    res.json({ success: true, data: issues });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/batches/:batchId/validate', (req, res) => {
  try {
    const result = settlementService.processBatch(parseInt(req.params.batchId));
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/batches/:batchId/trial', (req, res) => {
  try {
    const result = settlementService.trialCalculate(parseInt(req.params.batchId));
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/batches/:batchId/settle', (req, res) => {
  try {
    const result = settlementService.settleBatch(parseInt(req.params.batchId));
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/batches/:batchId/export', (req, res) => {
  try {
    const result = settlementService.exportSettlement(parseInt(req.params.batchId));
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/items/:itemId', (req, res) => {
  try {
    const item = itemDao.getItemById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/items/:itemId/trace', (req, res) => {
  try {
    const trace = settlementService.getItemTrace(parseInt(req.params.itemId));
    if (!trace) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: trace });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/items/:itemId/authorize', (req, res) => {
  try {
    const { auth_type, auth_field, authorized_value, reason, authorized_by } = req.body;
    
    if (!auth_type || !auth_field || authorized_value === undefined || !reason || !authorized_by) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const authId = settlementService.authorizeItem(
      parseInt(req.params.itemId),
      auth_type,
      auth_field,
      authorized_value,
      reason,
      authorized_by
    );
    
    res.json({ success: true, data: { auth_id: authId } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/batches/:batchId/authorize-batch', (req, res) => {
  try {
    const { item_ids, auth_type, auth_field, authorized_value, reason, authorized_by } = req.body;
    
    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择要授权的记录' });
    }
    if (!auth_type || !auth_field || authorized_value === undefined || !reason || !authorized_by) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const results = settlementService.authorizeBatchItems(
      parseInt(req.params.batchId),
      item_ids,
      auth_type,
      auth_field,
      authorized_value,
      reason,
      authorized_by
    );
    
    res.json({ success: true, data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/items/:itemId/settle', (req, res) => {
  try {
    const result = settlementService.settleItem(parseInt(req.params.itemId));
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/exports', (req, res) => {
  try {
    const exports = exportDao.listAllExports();
    res.json({ success: true, data: exports });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/exports/:exportId/download', (req, res) => {
  try {
    const exportRecord = exportDao.getExportById(req.params.exportId);
    if (!exportRecord) {
      return res.status(404).json({ success: false, error: '导出记录不存在' });
    }
    
    if (!fs.existsSync(exportRecord.file_path)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }
    
    res.download(exportRecord.file_path, exportRecord.file_name);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/batches/:batchId/authorizations', (req, res) => {
  try {
    const auths = authDao.getAuthorizationsByBatch(parseInt(req.params.batchId));
    res.json({ success: true, data: auths });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      commission_rates: config.COMMISSION_RATES,
      discount_auth_threshold: config.DISCOUNT_AUTH_THRESHOLD,
      status: config.STATUS,
      severity: config.SEVERITY
    }
  });
});

module.exports = router;
