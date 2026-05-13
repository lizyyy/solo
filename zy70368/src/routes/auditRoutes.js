const express = require('express');
const MaskingService = require('../services/maskingService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const {
      userId,
      role,
      resourceType,
      resourceId,
      policyVersionId,
      success
    } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (role) filters.role = role;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;
    if (policyVersionId) filters.policyVersionId = policyVersionId;
    if (success !== undefined) {
      filters.success = success === 'true' || success === true;
    }

    const logs = MaskingService.getAuditLogs(filters);
    res.json(logs);
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.get('/:logId', (req, res) => {
  try {
    const { logId } = req.params;
    const log = MaskingService.getAuditLogById(logId);
    if (!log) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Audit log not found'
      });
    }
    res.json(log);
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.get('/by-resource/:resourceType/:resourceId', (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const logs = MaskingService.getAuditLogs({ resourceType, resourceId });
    res.json(logs);
  } catch (error) {
    console.error('Error getting audit logs by resource:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.get('/by-policy-version/:policyVersionId', (req, res) => {
  try {
    const { policyVersionId } = req.params;
    const logs = MaskingService.getAuditLogs({ policyVersionId });
    res.json(logs);
  } catch (error) {
    console.error('Error getting audit logs by policy version:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
