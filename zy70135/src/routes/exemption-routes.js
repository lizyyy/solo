const express = require('express');
const { body, query, validationResult } = require('express-validator');
const ExemptionService = require('../services/exemption-service');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { validate } = require('../middlewares/validators');
const ResponseUtils = require('../utils/response');
const { PERMISSIONS } = require('../core/constants');

const router = express.Router();

router.post(
  '/',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.EXEMPTION_REQUEST),
    body('blacklistId').notEmpty().withMessage('黑名单ID不能为空'),
    body('reason').notEmpty().withMessage('豁免原因不能为空'),
    body('type').isIn(['temporary', 'permanent', 'emergency']).withMessage('豁免类型无效'),
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

      const result = await ExemptionService.create(req.body, requestContext);
      ResponseUtils.success(res, result, '豁免申请已提交', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.EXEMPTION_VIEW),
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
        type: req.query.type,
        memberIdentifier: req.query.memberIdentifier,
        blacklistId: req.query.blacklistId,
        businessLineId: req.query.businessLineId,
        requesterId: req.query.requesterId,
        approverId: req.query.approverId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await ExemptionService.list(filters, options, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/pending',
  [authMiddleware(), requirePermission(PERMISSIONS.EXEMPTION_APPROVE)],
  async (req, res, next) => {
    try {
      const requestContext = {
        userId: req.user.userId,
        role: req.user.role,
        businessLineId: req.user.businessLineId,
      };

      const result = await ExemptionService.getPendingForApproval(req.user.role, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/statistics',
  [authMiddleware(), requirePermission(PERMISSIONS.EXEMPTION_VIEW)],
  async (req, res, next) => {
    try {
      const filters = {
        businessLineId: req.user.role === 'admin' ? req.query.businessLineId : req.user.businessLineId,
      };

      const result = await ExemptionService.getStatistics(filters);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  [authMiddleware(), requirePermission(PERMISSIONS.EXEMPTION_VIEW)],
  async (req, res, next) => {
    try {
      const requestContext = {
        userId: req.user.userId,
        role: req.user.role,
        businessLineId: req.user.businessLineId,
      };

      const result = await ExemptionService.findById(req.params.id, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/approve',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.EXEMPTION_APPROVE),
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

      const result = await ExemptionService.approve(req.params.id, req.body, requestContext);
      ResponseUtils.success(res, result, '审批通过');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/reject',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.EXEMPTION_APPROVE),
    body('reason').notEmpty().isLength({ min: 10 }).withMessage('拒绝原因不能少于10个字符'),
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

      const result = await ExemptionService.reject(req.params.id, req.body, requestContext);
      ResponseUtils.success(res, result, '已拒绝');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/revoke',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.EXEMPTION_REVOKE),
    body('reason').notEmpty().isLength({ min: 10 }).withMessage('撤销原因不能少于10个字符'),
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

      const result = await ExemptionService.revoke(req.params.id, req.body, requestContext);
      ResponseUtils.success(res, result, '已撤销');
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
