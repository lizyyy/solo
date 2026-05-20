const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ImportService = require('../services/ImportService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.post('/beds', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const handler = req.body.handler || 'admin';
    const result = await ImportService.importBedsFromCSV(req.file.path, handler);

    res.json({
      success: true,
      message: `成功导入 ${result.imported}/${result.total} 条床位记录`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/patient-transfers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }

    const handler = req.body.handler || 'admin';
    const result = await ImportService.importPatientTransfersFromJSON(req.file.path, handler);

    res.json({
      success: true,
      message: `成功导入 ${result.imported}/${result.total} 条患者流转记录`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/cleaning-orders', async (req, res) => {
  try {
    const { orders, handler } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: '请提供订单数组' });
    }

    const result = await ImportService.importCleaningOrders(orders, handler || 'admin');

    res.json({
      success: true,
      message: `成功导入 ${result.imported}/${result.total} 条保洁工单`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
