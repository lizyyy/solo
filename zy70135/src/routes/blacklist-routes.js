const express = require('express');
const { body, query, validationResult } = require('express-validator');
const BlacklistService = require('../services/blacklist-service');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { validate } = require('../middlewares/validators');
const ResponseUtils = require('../utils/response');
const { PERMISSIONS } = require('../core/constants');

const router = express.Router();

router.post(
  '/',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.BLACKLIST_CREATE),
    body('memberIdentifier').notEmpty().withMessage('会员标识不能为空'),
    body('reason').notEmpty().withMessage('原因不能为空'),
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

      const result = await BlacklistService.create(req.body, requestContext);
      ResponseUtils.success(res, result, '添加成功', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.BLACKLIST_VIEW),
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
        status: req.query.status,
        sourceType: req.query.sourceType,
        isShared: req.query.isShared !== undefined ? req.query.isShared === 'true' : undefined,
        isManuallyCorrected: req.query.isManuallyCorrected !== undefined ? req.query.isManuallyCorrected === 'true' : undefined,
        memberIdentifier: req.query.memberIdentifier,
        businessLineId: req.query.businessLineId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await BlacklistService.list(filters, options, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/check',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.BLACKLIST_VIEW),
    query('memberIdentifier').notEmpty().withMessage('会员标识不能为空'),
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

      const context = {
        scene: req.query.scene,
        reference: req.query.reference,
      };

      const result = await BlacklistService.checkMember(
        req.query.memberIdentifier,
        req.query.identifierType || 'phone',
        context,
        requestContext
      );

      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/statistics',
  [authMiddleware(), requirePermission(PERMISSIONS.BLACKLIST_VIEW)],
  async (req, res, next) => {
    try {
      const filters = {
        businessLineId: req.user.role === 'admin' ? req.query.businessLineId : req.user.businessLineId,
      };

      const result = await BlacklistService.getStatistics(filters);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  [authMiddleware(), requirePermission(PERMISSIONS.BLACKLIST_VIEW)],
  async (req, res, next) => {
    try {
      const requestContext = {
        userId: req.user.userId,
        role: req.user.role,
        businessLineId: req.user.businessLineId,
      };

      const result = await BlacklistService.findById(req.params.id, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.BLACKLIST_UPDATE),
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

      const result = await BlacklistService.update(req.params.id, req.body, requestContext);
      ResponseUtils.success(res, result, '更新成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/remove',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.BLACKLIST_DELETE),
    body('removalReason').notEmpty().withMessage('移除原因不能为空'),
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

      const result = await BlacklistService.remove(
        req.params.id,
        req.body.removalReason,
        requestContext
      );

      ResponseUtils.success(res, result, '移除成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/manual-correct',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.BLACKLIST_MANUAL_CORRECT),
    body('reason').notEmpty().isLength({ min: 10 }).withMessage('修正原因不能少于10个字符'),
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

      const result = await BlacklistService.manualCorrect(req.params.id, req.body, requestContext);
      ResponseUtils.success(res, result, '人工修正成功');
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id/history',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.BLACKLIST_VIEW),
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

      const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
      };

      const result = await BlacklistService.getHistory(req.params.id, options, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/batch-import',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.BLACKLIST_CREATE),
    body('items').isArray({ min: 1 }).withMessage('请提供至少一条数据'),
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

      const result = await BlacklistService.batchImport(req.body.items, requestContext);
      ResponseUtils.success(res, result, '批量导入完成');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/sync/:versionId',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_VIEW),
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

      const result = await BlacklistService.syncFromVersion(req.params.versionId, requestContext);
      ResponseUtils.success(res, result, '同步完成');
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
