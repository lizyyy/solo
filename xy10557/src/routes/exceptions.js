const express = require('express');
const router = express.Router();
const pickupService = require('../services/pickupService');

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      entityType: req.query.entityType,
      exceptionType: req.query.exceptionType
    };
    
    const exceptions = pickupService.getExceptions(filters);
    
    res.json({
      success: true,
      data: exceptions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:exceptionId/resolve', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const { resolution, beforeState, afterState } = req.body;
    
    if (!resolution) {
      return res.status(400).json({
        success: false,
        message: '必须提供处理方案'
      });
    }
    
    const exception = pickupService.resolveException(
      req.params.exceptionId,
      resolution,
      operator,
      beforeState,
      afterState
    );
    
    res.json({
      success: true,
      data: exception,
      message: '异常已处理'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
