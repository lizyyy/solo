const express = require('express');
const MaskingService = require('../services/maskingService');

const router = express.Router();

router.get('/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-role'];

    if (!userId || !role) {
      MaskingService.createAuditLog({
        userId: userId || 'anonymous',
        role: role || 'unknown',
        action: 'access_denied',
        resourceType: 'order',
        resourceId: orderId,
        success: false,
        reason: 'missing_auth_headers'
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing required headers: x-user-id and x-role'
      });
    }

    const order = MaskingService.getMockOrder(orderId);
    if (!order) {
      MaskingService.createAuditLog({
        userId,
        role,
        action: 'access_denied',
        resourceType: 'order',
        resourceId: orderId,
        success: false,
        reason: 'resource_not_found'
      });
      return res.status(404).json({
        error: 'Not Found',
        message: 'Order not found'
      });
    }

    const filteredResult = MaskingService.filterResponse(
      order,
      'order',
      role,
      userId
    );

    MaskingService.createAuditLog({
      userId,
      role,
      action: 'access_order',
      resourceType: 'order',
      resourceId: orderId,
      policyId: filteredResult.policyId,
      policyVersionId: filteredResult.policyVersionId,
      policyVersion: filteredResult.policyVersion,
      success: true,
      reason: 'authorized_access',
      hiddenFields: filteredResult.hiddenFields,
      maskedFields: filteredResult.maskedFields,
      exceptionApplied: filteredResult.exceptionApplied
    });

    res.json({
      data: filteredResult.data,
      _meta: {
        policyVersionId: filteredResult.policyVersionId,
        policyVersion: filteredResult.policyVersion,
        hiddenFields: filteredResult.hiddenFields,
        maskedFields: filteredResult.maskedFields.map(m => ({
          field: m.field,
          maskType: m.maskType,
          exceptionApplied: m.exceptionApplied || false
        })),
        exceptionApplied: filteredResult.exceptionApplied
      }
    });
  } catch (error) {
    console.error('Error accessing order:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
