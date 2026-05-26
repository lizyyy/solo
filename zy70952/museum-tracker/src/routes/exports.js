const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const exportService = require('../services/exportService');
const { success, fail, paginate } = require('../utils/response');

router.get('/batch/:id', async (req, res) => {
  try {
    const exportDir = path.resolve(__dirname, '..', '..', 'exports');
    const result = await exportService.exportBatchDetail(req.params.id, exportDir);
    success(res, result, '批次明细导出成功');
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.get('/artifacts/by-level/:level', async (req, res) => {
  try {
    const exportDir = path.resolve(__dirname, '..', '..', 'exports');
    const result = await exportService.exportArtifactsByLevel(req.params.level, exportDir);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.get('/batch-list', paginate, async (req, res) => {
  try {
    const exportDir = path.resolve(__dirname, '..', '..', 'exports');
    const result = await exportService.exportBatchList(req.query, req.pagination, exportDir);
    success(res, result);
  } catch (e) {
    fail(res, e.message, 400);
  }
});

router.get('/download/:filename', async (req, res) => {
  try {
    const exportDir = path.resolve(__dirname, '..', '..', 'exports');
    const filePath = path.join(exportDir, req.params.filename);
    if (!fs.existsSync(filePath)) return fail(res, '文件不存在', 404);
    res.download(filePath);
  } catch (e) {
    fail(res, e.message, 500);
  }
});

module.exports = router;
