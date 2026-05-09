const express = require('express');
const { ApiResponse } = require('../utils/response');
const ExportService = require('../services/exportService');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');

const router = express.Router();

router.post('/ledger', authenticate, async (req, res, next) => {
  try {
    const { export_format = 'excel', criteria = {} } = req.body;
    const validFormats = ['csv', 'excel', 'xlsx'];
    
    if (!validFormats.includes(export_format)) {
      return res.status(400).json(ApiResponse.error(
        `无效的导出格式，支持: ${validFormats.join(', ')}`,
        400
      ));
    }

    const result = await ExportService.createExportTask(req, 'ledger', export_format, criteria);
    res.json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
});

router.post('/photos', authenticate, async (req, res, next) => {
  try {
    const { export_format = 'excel', criteria = {} } = req.body;
    const validFormats = ['csv', 'excel', 'xlsx'];
    
    if (!validFormats.includes(export_format)) {
      return res.status(400).json(ApiResponse.error(
        `无效的导出格式，支持: ${validFormats.join(', ')}`,
        400
      ));
    }

    const result = await ExportService.createExportTask(req, 'photos', export_format, criteria);
    res.json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
});

router.get('/status/:exportId', authenticate, async (req, res, next) => {
  try {
    const status = await ExportService.getExportStatus(req.params.exportId);
    res.json(ApiResponse.success(status));
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { 
      export_type, status, requested_by,
      page = 1, page_size = 20 
    } = req.query;

    const result = await ExportService.listExports(
      {
        export_type,
        status,
        requested_by
      },
      parseInt(page),
      parseInt(page_size)
    );

    res.json(ApiResponse.pagination(result.exports, result.total, page, page_size));
  } catch (error) {
    next(error);
  }
});

router.post('/retry/:exportId', authenticate, async (req, res, next) => {
  try {
    const result = await ExportService.retryExport(req, req.params.exportId);
    res.json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
});

router.get('/download/:exportId', authenticate, async (req, res, next) => {
  try {
    const exportRecord = await ExportService.getExportStatus(req.params.exportId);
    
    if (exportRecord.status !== 'completed') {
      return res.status(400).json(ApiResponse.error(
        `导出尚未完成，当前状态: ${exportRecord.status}`,
        400
      ));
    }

    if (!exportRecord.file_path || !fs.existsSync(exportRecord.file_path)) {
      return res.status(404).json(ApiResponse.error('导出文件不存在', 404));
    }

    res.download(exportRecord.file_path);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
