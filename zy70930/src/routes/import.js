const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const importService = require('../services/importService');
const auditService = require('../services/auditService');

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
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.post('/packages', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { batchId, storeId } = req.body;
    
    if (!batchId || !req.file) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const effectiveStoreId = req.user.role === 'admin' ? storeId : req.user.storeId;
    const result = await importService.importPackagesFromCsv(
      req.file.path, batchId, effectiveStoreId
    );

    await auditService.logAction(
      req.user.id, req.user.realName, auditService.ACTIONS.DATA_IMPORTED,
      { batchId, type: 'packages', ...result },
      null, null, batchId, null
    );

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workorders', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { batchId, storeId } = req.body;
    
    if (!batchId || !req.file) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const effectiveStoreId = req.user.role === 'admin' ? storeId : req.user.storeId;
    const result = await importService.importWorkOrdersFromJson(
      req.file.path, batchId, effectiveStoreId
    );

    await auditService.logAction(
      req.user.id, req.user.realName, auditService.ACTIONS.DATA_IMPORTED,
      { batchId, type: 'workorders', ...result },
      null, null, batchId, null
    );

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/inventory', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { batchId, storeId } = req.body;
    
    if (!batchId || !req.file) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const effectiveStoreId = req.user.role === 'admin' ? storeId : req.user.storeId;
    const result = await importService.importInventoryFromCsv(
      req.file.path, batchId, effectiveStoreId
    );

    await auditService.logAction(
      req.user.id, req.user.realName, auditService.ACTIONS.DATA_IMPORTED,
      { batchId, type: 'inventory', ...result },
      null, null, batchId, null
    );

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
