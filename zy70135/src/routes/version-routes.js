const express = require('express');
const { body, query } = require('express-validator');
const VersionService = require('../services/version-service');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { validate } = require('../middlewares/validators');
const ResponseUtils = require('../utils/response');
const { PERMISSIONS } = require('../core/constants');

const router = express.Router();

router.post(
  '/',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_CREATE),
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

      const result = await VersionService.createDraft(req.body, requestContext);
      ResponseUtils.success(res, result, '版本创建成功', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_VIEW),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const filters = {
        status: req.query.status,
        versionNumber: req.query.versionNumber,
        businessLineId: req.user.role === 'admin' ? req.query.businessLineId : req.user.businessLineId,
        publishedBy: req.query.publishedBy,
      };

      const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await VersionService.list(filters, options);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/latest',
  [authMiddleware(), requirePermission(PERMISSIONS.VERSION_VIEW)],
  async (req, res, next) => {
    try {
      const result = await VersionService.getLatestPublished();
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/statistics',
  [authMiddleware(), requirePermission(PERMISSIONS.VERSION_VIEW)],
  async (req, res, next) => {
    try {
      const filters = {
        businessLineId: req.user.role === 'admin' ? req.query.businessLineId : req.user.businessLineId,
      };

      const result = await VersionService.getStatistics(filters);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  [authMiddleware(), requirePermission(PERMISSIONS.VERSION_VIEW)],
  async (req, res, next) => {
    try {
      const requestContext = {
        userId: req.user.userId,
        role: req.user.role,
        businessLineId: req.user.businessLineId,
      };

      const result = await VersionService.findById(req.params.id, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/items',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_CREATE),
    body('items').isArray({ min: 0 }).withMessage('items 必须是数组'),
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

      const result = await VersionService.addItemsToVersion(
        req.params.id,
        req.body.items,
        requestContext
      );

      ResponseUtils.success(res, result, '版本内容已更新');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/build',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_CREATE),
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

      const result = await VersionService.buildVersionFromCurrentState(
        req.params.id,
        requestContext
      );

      ResponseUtils.success(res, result, '版本构建成功');
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id/diff',
  [authMiddleware(), requirePermission(PERMISSIONS.VERSION_VIEW)],
  async (req, res, next) => {
    try {
      const requestContext = {
        userId: req.user.userId,
        role: req.user.role,
        businessLineId: req.user.businessLineId,
      };

      const result = await VersionService.calculateVersionDiff(req.params.id, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/publish',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_PUBLISH),
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

      const result = await VersionService.publish(req.params.id, requestContext);
      ResponseUtils.success(res, result, '版本发布成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/archive',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_PUBLISH),
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

      const result = await VersionService.archive(req.params.id, requestContext);
      ResponseUtils.success(res, result, '版本已归档');
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_CREATE),
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

      await VersionService.deleteDraft(req.params.id, requestContext);
      ResponseUtils.success(res, null, '草稿版本已删除');
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
