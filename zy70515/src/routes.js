const express = require('express');
const router = express.Router();
const models = require('./models');

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.post('/packages', asyncHandler(async (req, res) => {
  try {
    const required = ['caseId', 'evidenceType', 'fileName', 'fileHash'];
    for (const field of required) {
      if (!req.body[field]) {
        models.recordFailure('create_package', req.body, 
          `Missing required field: ${field}`, 
          'Request rejected due to missing field');
        return res.status(400).json({ 
          error: 'Validation failed', 
          message: `Missing required field: ${field}` 
        });
      }
    }
    
    const pkg = models.createEvidencePackage(req.body);
    res.status(201).json({
      success: true,
      data: pkg
    });
  } catch (error) {
    models.recordFailure('create_package', req.body, error.message, 'Internal server error');
    res.status(500).json({ error: error.message });
  }
}));

router.get('/packages', asyncHandler(async (req, res) => {
  const { status, caseId } = req.query;
  const packages = models.listEvidencePackages({ status, caseId });
  res.json({
    success: true,
    data: packages
  });
}));

router.get('/packages/:id', asyncHandler(async (req, res) => {
  const pkg = models.getEvidencePackage(req.params.id);
  if (!pkg) {
    return res.status(404).json({ error: 'Package not found' });
  }
  res.json({
    success: true,
    data: pkg
  });
}));

router.patch('/packages/:id/status', asyncHandler(async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!status) {
      models.recordFailure('update_status', { id: req.params.id, ...req.body },
        'Missing status field', 'Request rejected');
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const updated = models.updatePackageStatus(req.params.id, status, reason);
    if (!updated) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    models.recordFailure('update_status', { id: req.params.id, ...req.body },
      error.message, 'Status update failed');
    res.status(400).json({ error: error.message });
  }
}));

router.patch('/packages/:id/correct', asyncHandler(async (req, res) => {
  try {
    const { corrections, correctedBy } = req.body;
    if (!corrections || !correctedBy) {
      models.recordFailure('manual_correct', req.body,
        'Missing corrections or correctedBy', 'Request rejected');
      return res.status(400).json({ error: 'corrections and correctedBy are required' });
    }
    
    const updated = models.manualCorrect(req.params.id, corrections, correctedBy);
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    models.recordFailure('manual_correct', req.body, error.message, 'Manual correction failed');
    res.status(400).json({ error: error.message });
  }
}));

router.get('/packages/:id/audit-log', asyncHandler(async (req, res) => {
  const logs = models.getAuditLogs(req.params.id);
  res.json({
    success: true,
    data: logs
  });
}));

router.post('/downloaders', asyncHandler(async (req, res) => {
  if (!req.body.employeeId) {
    return res.status(400).json({ error: 'employeeId is required' });
  }
  const downloader = models.getOrCreateDownloader(req.body);
  res.json({
    success: true,
    data: downloader
  });
}));

router.post('/watermarks', asyncHandler(async (req, res) => {
  try {
    const { packageId, downloaderId, customText } = req.body;
    if (!packageId || !downloaderId) {
      models.recordFailure('create_watermark', req.body,
        'Missing packageId or downloaderId', 'Request rejected');
      return res.status(400).json({ error: 'packageId and downloaderId are required' });
    }
    
    const watermark = models.createWatermark(packageId, downloaderId, customText);
    res.status(201).json({
      success: true,
      data: watermark
    });
  } catch (error) {
    models.recordFailure('create_watermark', req.body, error.message, 'Watermark creation failed');
    res.status(400).json({ error: error.message });
  }
}));

router.get('/packages/:id/watermarks', asyncHandler(async (req, res) => {
  const watermarks = models.listWatermarks(req.params.id);
  res.json({
    success: true,
    data: watermarks
  });
}));

router.post('/authorizations', asyncHandler(async (req, res) => {
  try {
    const { packageId, downloaderId, scope, expiresAt, grantedBy } = req.body;
    if (!packageId || !downloaderId) {
      models.recordFailure('create_authorization', req.body,
        'Missing packageId or downloaderId', 'Request rejected');
      return res.status(400).json({ error: 'packageId and downloaderId are required' });
    }
    
    const auth = models.createAuthorization(packageId, downloaderId, scope, expiresAt, grantedBy);
    res.status(201).json({
      success: true,
      data: auth
    });
  } catch (error) {
    models.recordFailure('create_authorization', req.body, error.message, 'Authorization creation failed');
    res.status(400).json({ error: error.message });
  }
}));

router.get('/authorizations/check', asyncHandler(async (req, res) => {
  const { packageId, downloaderId } = req.query;
  if (!packageId || !downloaderId) {
    return res.status(400).json({ error: 'packageId and downloaderId are required' });
  }
  
  const result = models.checkAuthorization(packageId, downloaderId);
  res.json({
    success: true,
    data: result
  });
}));

router.post('/authorizations/:id/revoke', asyncHandler(async (req, res) => {
  try {
    const { reason, revokedBy } = req.body;
    if (!reason || !revokedBy) {
      models.recordFailure('revoke_authorization', req.body,
        'Missing reason or revokedBy', 'Request rejected');
      return res.status(400).json({ error: 'reason and revokedBy are required' });
    }
    
    const revoked = models.revokeAuthorization(req.params.id, reason, revokedBy);
    res.json({
      success: true,
      data: revoked
    });
  } catch (error) {
    models.recordFailure('revoke_authorization', req.body, error.message, 'Revocation failed');
    res.status(400).json({ error: error.message });
  }
}));

router.post('/downloads', asyncHandler(async (req, res) => {
  try {
    const { packageId, downloaderId, ipAddress } = req.body;
    if (!packageId || !downloaderId) {
      models.recordFailure('record_download', req.body,
        'Missing packageId or downloaderId', 'Request rejected');
      return res.status(400).json({ error: 'packageId and downloaderId are required' });
    }
    
    const record = models.recordDownload(packageId, downloaderId, ipAddress || 'unknown');
    res.status(201).json({
      success: true,
      data: record
    });
  } catch (error) {
    models.recordFailure('record_download', req.body, error.message, 'Download recording failed');
    res.status(400).json({ error: error.message });
  }
}));

router.get('/packages/:id/tracking', asyncHandler(async (req, res) => {
  const tracking = models.getTrackingSummary(req.params.id);
  res.json({
    success: true,
    data: tracking
  });
}));

router.get('/failures', asyncHandler(async (req, res) => {
  const { operation } = req.query;
  const failures = models.listFailures(operation);
  res.json({
    success: true,
    data: failures
  });
}));

router.get('/export', asyncHandler(async (req, res) => {
  const { packageId } = req.query;
  const data = models.exportTrackingData(packageId);
  res.json({
    success: true,
    exportTime: new Date().toISOString(),
    data: data
  });
}));

router.get('/statuses', (req, res) => {
  res.json({
    success: true,
    data: models.PACKAGE_STATUSES
  });
});

module.exports = router;
