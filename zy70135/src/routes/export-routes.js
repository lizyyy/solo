const express = require('express');
const { body, query } = require('express-validator');
const fs = require('fs');
const path = require('path');
const ExportService = require('../services/export-service');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { validate } = require('../middlewares/validators');
const ResponseUtils = require('../utils/response');
const { PERMISSIONS } = require('../core/constants');
const logger = require('../utils/logger');

const router = express.Router();

router.post(
  '/',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.EXPORT),
    body('type').isIn(['blacklist', 'hit_records', 'audit_logs', 'risk_report']).withMessage('导出类型无效'),
    body('format').optional().isIn(['csv', 'json']),
    validate,
  ],
  async (req, res, next) => {
    try {
      const requestContext = {
        userId: req.user.userId,
        displayName: req.user.displayName,
        role: req.user.role,
        businessLineId: req.user.businessLineId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
      };

      const result = await ExportService.createRequest(req.body, requestContext);
      ResponseUtils.success(res, result, '导出请求已处理');
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.EXPORT),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const requestContext = {
        userId: req.user.userId,
        role: req.user.role,
        businessLineId: req.user.businessLineId,
      };

      const filters = {
        type: req.query.type,
        status: req.query.status,
      };

      const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
      };

      const result = await ExportService.listMyExports(requestContext, filters, options);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:code/download',
  [authMiddleware(), requirePermission(PERMISSIONS.EXPORT)],
  async (req, res, next) => {
    try {
      const requestContext = {
        userId: req.user.userId,
        role: req.user.role,
        businessLineId: req.user.businessLineId,
      };

      const downloadInfo = await ExportService.getDownloadInfo(req.params.code, requestContext);

      if (!downloadInfo) {
        return ResponseUtils.notFound(res, '导出文件不存在或已过期');
      }

      if (!fs.existsSync(downloadInfo.filePath)) {
        return ResponseUtils.notFound(res, '导出文件不存在');
      }

      const ext = path.extname(downloadInfo.filePath).toLowerCase();
      const contentType = ext === '.csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(downloadInfo.fileName)}`
      );
      res.setHeader('X-Total-Count', downloadInfo.recordCount);

      const fileStream = fs.createReadStream(downloadInfo.filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error('下载导出文件失败:', error);
      next(error);
    }
  }
);

module.exports = router;
