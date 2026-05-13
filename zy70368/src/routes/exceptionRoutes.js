const express = require('express');
const MaskingService = require('../services/maskingService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { userId, role, resourceType, resourceId } = req.query;
    const filters = {};
    if (userId) filters.userId = userId;
    if (role) filters.role = role;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;

    const exceptions = MaskingService.listExceptions(filters);
    res.json(exceptions);
  } catch (error) {
    console.error('Error listing exceptions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const {
      userId,
      role,
      resourceType,
      resourceId,
      grantedFields,
      expiresAt,
      reason
    } = req.body;

    if (!userId || !role || !resourceType || !resourceId || !grantedFields || !expiresAt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: userId, role, resourceType, resourceId, grantedFields, expiresAt'
      });
    }

    const exception = MaskingService.createException({
      userId,
      role,
      resourceType,
      resourceId,
      grantedFields,
      expiresAt,
      reason
    });

    res.status(201).json(exception);
  } catch (error) {
    console.error('Error creating exception:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.get('/:exceptionId', (req, res) => {
  try {
    const { exceptionId } = req.params;
    const exception = MaskingService.getException(exceptionId);
    if (!exception) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Exception not found'
      });
    }
    res.json(exception);
  } catch (error) {
    console.error('Error getting exception:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
