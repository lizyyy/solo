const express = require('express');
const router = express.Router();
const RiskService = require('../services/riskService');
const { validateResolveFailedOperation } = require('../middleware/validation');

router.get('/', async (req, res) => {
  try {
    const filters = {
      risk_id: req.query.risk_id,
      operation_type: req.query.operation_type,
      resolved: req.query.resolved ? req.query.resolved === 'true' : undefined
    };
    const operations = await RiskService.getFailedOperations(filters);
    res.json({
      success: true,
      data: operations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const operation = await RiskService.getFailedOperationById(req.params.id);
    if (!operation) {
      return res.status(404).json({
        success: false,
        error: '失败操作记录不存在'
      });
    }
    res.json({
      success: true,
      data: operation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.patch('/:id/resolve', validateResolveFailedOperation, async (req, res) => {
  try {
    const operation = await RiskService.resolveFailedOperation(
      req.params.id,
      req.body.resolved_by,
      req.body.resolution_notes,
      req.body.final_conclusion
    );
    res.json({
      success: true,
      data: operation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
