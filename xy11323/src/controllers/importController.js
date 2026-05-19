const multer = require('multer');
const path = require('path');
const { importWorkOrders, importFuelRecords, importRateConfigs } = require('../services/importService');

const uploadsDir = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

const importWorkOrdersController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }

    const result = await importWorkOrders(req.file.path, req.file.originalname);
    res.json({
      message: '作业单导入完成',
      batch_id: result.batch_id,
      total: result.total,
      success: result.success,
      errors: result.errors
    });
  } catch (error) {
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
};

const importFuelRecordsController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 JSON 文件' });
    }

    const result = await importFuelRecords(req.file.path, req.file.originalname);
    res.json({
      message: '油耗表导入完成',
      batch_id: result.batch_id,
      total: result.total,
      success: result.success,
      errors: result.errors
    });
  } catch (error) {
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
};

const importRateConfigsController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }

    const result = await importRateConfigs(req.file.path, req.file.originalname);
    res.json({
      message: '费率表导入完成',
      batch_id: result.batch_id,
      total: result.total,
      success: result.success,
      errors: result.errors
    });
  } catch (error) {
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
};

module.exports = {
  upload,
  importWorkOrdersController,
  importFuelRecordsController,
  importRateConfigsController
};