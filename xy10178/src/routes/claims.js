const express = require('express');
const router = express.Router();
const claimService = require('../services/claimService');

function handleServiceResult(res, result) {
  if (result.success) {
    return res.json(result);
  }
  
  const statusCodes = {
    'CLAIM_NOT_FOUND': 404,
    'CASE_NUMBER_EXISTS': 409,
    'INVALID_RATIO': 400,
    'DUPLICATE_REQUEST': 409,
    'INVALID_STATUS': 400,
    'NO_RATIOS_SET': 400,
    'INVALID_STATUS_TRANSITION': 400,
    'VERSION_NOT_FOUND': 404,
    'INVALID_TARGET_VERSION': 400
  };
  
  const statusCode = statusCodes[result.code] || 400;
  return res.status(statusCode).json(result);
}

router.post('/', async (req, res, next) => {
  try {
    const { caseNumber, totalAmount, description, operator, requestId } = req.body;
    
    if (!caseNumber || totalAmount == null || !operator) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'caseNumber、totalAmount 和 operator 为必填字段'
      });
    }
    
    const result = await claimService.createClaim({
      caseNumber,
      totalAmount,
      description,
      operator,
      requestId
    });
    
    handleServiceResult(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, page, pageSize } = req.query;
    const result = await claimService.listClaims({
      status,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const claim = await claimService.getClaimWithVersion(req.params.id);
    if (!claim) {
      return res.status(404).json({
        success: false,
        code: 'CLAIM_NOT_FOUND',
        message: '案件不存在'
      });
    }
    res.json({
      success: true,
      data: claim
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/ratios', async (req, res, next) => {
  try {
    const { merchantRatio, warehouseRatio, deliveryRatio, operator, requestId } = req.body;
    
    if (merchantRatio == null || warehouseRatio == null || deliveryRatio == null || !operator) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'merchantRatio、warehouseRatio、deliveryRatio 和 operator 为必填字段'
      });
    }
    
    const result = await claimService.updateRatios({
      claimId: req.params.id,
      merchantRatio: Number(merchantRatio),
      warehouseRatio: Number(warehouseRatio),
      deliveryRatio: Number(deliveryRatio),
      operator,
      requestId
    });
    
    handleServiceResult(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/allocate', async (req, res, next) => {
  try {
    const { operator, requestId } = req.body;
    if (!operator) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'operator 为必填字段'
      });
    }
    
    const result = await claimService.allocateClaim({
      claimId: req.params.id,
      operator,
      requestId
    });
    
    handleServiceResult(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/confirm', async (req, res, next) => {
  try {
    const { operator, requestId } = req.body;
    if (!operator) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'operator 为必填字段'
      });
    }
    
    const result = await claimService.confirmClaim({
      claimId: req.params.id,
      operator,
      requestId
    });
    
    handleServiceResult(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pay', async (req, res, next) => {
  try {
    const { operator, requestId } = req.body;
    if (!operator) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'operator 为必填字段'
      });
    }
    
    const result = await claimService.payClaim({
      claimId: req.params.id,
      operator,
      requestId
    });
    
    handleServiceResult(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { operator, reason, requestId } = req.body;
    if (!operator) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'operator 为必填字段'
      });
    }
    
    const result = await claimService.cancelClaim({
      claimId: req.params.id,
      operator,
      reason,
      requestId
    });
    
    handleServiceResult(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/rollback', async (req, res, next) => {
  try {
    const { targetVersion, operator, requestId } = req.body;
    if (targetVersion == null || !operator) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'targetVersion 和 operator 为必填字段'
      });
    }
    
    const result = await claimService.rollbackToVersion({
      claimId: req.params.id,
      targetVersion: parseInt(targetVersion),
      operator,
      requestId
    });
    
    handleServiceResult(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/versions', async (req, res, next) => {
  try {
    const result = await claimService.getVersionHistory(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/audit-logs', async (req, res, next) => {
  try {
    const result = await claimService.getAuditLogs(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
