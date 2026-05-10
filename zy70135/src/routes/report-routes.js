const express = require('express');
const { query } = require('express-validator');
const ReportService = require('../services/report-service');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { validate } = require('../middlewares/validators');
const ResponseUtils = require('../utils/response');
const { PERMISSIONS } = require('../core/constants');

const router = express.Router();

router.get(
  '/overview',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.REPORT_VIEW),
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
        businessLineId: req.user.role === 'admin' ? req.query.businessLineId : req.user.businessLineId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const result = await ReportService.getOverview(filters, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/trend',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.REPORT_VIEW),
    query('groupBy').optional().isIn(['day', 'week', 'month']),
    validate,
  ],
  async (req, res, next) => {
    try {
      const filters = {
        businessLineId: req.user.role === 'admin' ? req.query.businessLineId : req.user.businessLineId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const options = {
        groupBy: req.query.groupBy || 'day',
      };

      const result = await ReportService.getTrendReport(filters, options);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/risk',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.REPORT_VIEW),
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
        businessLineId: req.user.role === 'admin' ? req.query.businessLineId : req.user.businessLineId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const result = await ReportService.getRiskReport(filters, requestContext);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/sync-status',
  [
    authMiddleware(),
    requirePermission(PERMISSIONS.VERSION_VIEW),
    validate,
  ],
  async (req, res, next) => {
    try {
      const localVersion = req.query.localVersion;
      const businessLineId = req.user.role === 'admin' ? req.query.businessLineId : req.user.businessLineId;

      const result = await ReportService.getSyncStatus(localVersion, businessLineId);
      ResponseUtils.success(res, result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
