const ImportService = require('../services/ImportService');
const ImportBatch = require('../models/ImportBatch');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}_${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传CSV文件'));
    }
  }
});

class ImportController {
  static getUploadMiddleware() {
    return upload.single('file');
  }

  static async importCleaning(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请选择要上传的文件'
        });
      }

      const importedBy = req.body.imported_by || 'system';
      const ipAddress = req.ip || req.connection.remoteAddress;

      const result = await ImportService.importCleaningRecords(
        req.file.path,
        req.file.originalname,
        importedBy,
        ipAddress
      );

      res.json({
        success: true,
        message: '导入完成',
        data: {
          batchNumber: result.batchNumber,
          total: result.total,
          normal: result.normal,
          abnormal: result.abnormal,
          normalRecords: result.normalRecords.slice(0, 10),
          abnormalRecords: result.abnormalRecords.slice(0, 10),
          errors: result.errors
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getBatches(req, res) {
    try {
      const filters = {
        imported_by: req.query.imported_by,
        status: req.query.status
      };

      const batches = await ImportBatch.findAll(filters);

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
  }

  static async getBatchById(req, res) {
    try {
      const batch = await ImportBatch.findById(req.params.id);
      
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
  }

  static async getAbnormalRecords(req, res) {
    try {
      const { batchNumber } = req.params;
      const result = await ImportService.getAbnormalRecords(batchNumber);

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
  }
}

module.exports = ImportController;