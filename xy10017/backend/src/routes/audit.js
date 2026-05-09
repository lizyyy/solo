const express = require('express');
const auditService = require('../services/auditService');
const { authenticate, requireRole } = require('../middleware/auth');
const { success, pagination } = require('../utils/response');

const router = express.Router();

router.get('/', authenticate, requireRole('admin', 'viewer'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    
    const filters = {
      action: req.query.action,
      userId: req.query.userId,
      resourceType: req.query.resourceType,
      resourceId: req.query.resourceId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };
    
    const { logs, total } = await auditService.getAuditLogs(filters, page, limit);
    res.json(pagination(logs, total, page, limit));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
