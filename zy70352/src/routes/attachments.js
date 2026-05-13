const express = require('express');
const {
  ATTACHMENT_STATUS,
  SCAN_RESULT,
  createAttachment,
  getAttachment,
  updateAttachmentStatus,
  addScanRecord,
  getScanRecords,
  addAuditLog,
  getAuditLogs,
  addBusinessReference,
  getBusinessReferences
} = require('../models/attachment');
const { simulateVirusScan } = require('../services/virusScanner');

const router = express.Router();

const USABLE_STATUSES = [
  ATTACHMENT_STATUS.USABLE,
  ATTACHMENT_STATUS.MANUALLY_RELEASED
];

const DOWNLOADABLE_STATUSES = [
  ATTACHMENT_STATUS.USABLE,
  ATTACHMENT_STATUS.MANUALLY_RELEASED
];

function requireAttachment(req, res, next) {
  const attachment = getAttachment(req.params.id);
  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found' });
  }
  req.attachment = attachment;
  next();
}

router.post('/create', (req, res) => {
  const { filename, contentType, size, customerId, uploadSource } = req.body;

  if (!filename || !customerId) {
    return res.status(400).json({ error: 'filename and customerId are required' });
  }

  const attachment = createAttachment({
    filename,
    contentType,
    size,
    customerId,
    uploadSource
  });

  res.status(201).json(attachment);
});

router.post('/:id/isolate', requireAttachment, (req, res) => {
  const attachment = req.attachment;

  if (attachment.status === ATTACHMENT_STATUS.SCANNING) {
    return res.status(400).json({
      error: 'Attachment is currently being scanned',
      currentStatus: attachment.status
    });
  }

  const updated = updateAttachmentStatus(attachment.id, ATTACHMENT_STATUS.ISOLATED, {
    riskReason: null
  });

  res.json(updated);
});

router.post('/:id/scan', requireAttachment, (req, res) => {
  const attachment = req.attachment;
  const { forceResult } = req.body;

  const allowedStatuses = [
    ATTACHMENT_STATUS.ISOLATED,
    ATTACHMENT_STATUS.QUARANTINED,
    ATTACHMENT_STATUS.FAILED,
    ATTACHMENT_STATUS.MANUALLY_RELEASED
  ];

  if (!allowedStatuses.includes(attachment.status)) {
    return res.status(400).json({
      error: `Cannot scan from current status: ${attachment.status}`,
      allowedFrom: allowedStatuses
    });
  }

  updateAttachmentStatus(attachment.id, ATTACHMENT_STATUS.SCANNING);

  const scanResult = simulateVirusScan(attachment, forceResult);
  addScanRecord(attachment.id, scanResult.result, scanResult.details);

  if (scanResult.result === SCAN_RESULT.CLEAN) {
    const updated = updateAttachmentStatus(attachment.id, ATTACHMENT_STATUS.USABLE, {
      scanCount: attachment.scanCount + 1,
      lastScanResult: scanResult.result,
      riskReason: null
    });

    res.json({
      attachment: updated,
      scanResult
    });
  } else {
    const riskReason = scanResult.result === SCAN_RESULT.INFECTED
      ? `Virus detected: ${scanResult.details.threatName}`
      : `Suspicious activity detected: ${scanResult.details.threatName}`;

    const updated = updateAttachmentStatus(attachment.id, ATTACHMENT_STATUS.FAILED, {
      scanCount: attachment.scanCount + 1,
      lastScanResult: scanResult.result,
      riskReason
    });

    res.status(403).json({
      attachment: updated,
      scanResult,
      message: 'Attachment failed virus scan',
      riskReason
    });
  }
});

router.post('/:id/rescan', requireAttachment, (req, res) => {
  const attachment = req.attachment;
  const { forceResult } = req.body;

  if (attachment.status === ATTACHMENT_STATUS.SCANNING) {
    return res.status(400).json({
      error: 'Attachment is already being scanned',
      currentStatus: attachment.status
    });
  }

  if (attachment.status === ATTACHMENT_STATUS.USABLE && !req.body.force) {
    return res.status(400).json({
      error: 'Attachment is already usable. Use ?force=true to rescan.',
      currentStatus: attachment.status
    });
  }

  if (attachment.scanCount > 0 && !req.body.force) {
    return res.status(400).json({
      error: 'Attachment has already been scanned. Use ?force=true to rescan.',
      scanCount: attachment.scanCount
    });
  }

  updateAttachmentStatus(attachment.id, ATTACHMENT_STATUS.SCANNING);

  const scanResult = simulateVirusScan(attachment, forceResult);
  addScanRecord(attachment.id, scanResult.result, scanResult.details);

  if (scanResult.result === SCAN_RESULT.CLEAN) {
    const updated = updateAttachmentStatus(attachment.id, ATTACHMENT_STATUS.USABLE, {
      scanCount: attachment.scanCount + 1,
      lastScanResult: scanResult.result,
      riskReason: null
    });

    res.json({
      attachment: updated,
      scanResult,
      message: 'Rescan passed'
    });
  } else {
    const riskReason = scanResult.result === SCAN_RESULT.INFECTED
      ? `Virus detected: ${scanResult.details.threatName}`
      : `Suspicious activity detected: ${scanResult.details.threatName}`;

    const updated = updateAttachmentStatus(attachment.id, ATTACHMENT_STATUS.FAILED, {
      scanCount: attachment.scanCount + 1,
      lastScanResult: scanResult.result,
      riskReason
    });

    res.status(403).json({
      attachment: updated,
      scanResult,
      message: 'Rescan failed',
      riskReason
    });
  }
});

router.post('/:id/release', requireAttachment, (req, res) => {
  const attachment = req.attachment;
  const { reason, releasedBy } = req.body;

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: 'Release reason is required' });
  }

  if (!releasedBy) {
    return res.status(400).json({ error: 'releasedBy is required' });
  }

  const allowedStatuses = [
    ATTACHMENT_STATUS.FAILED,
    ATTACHMENT_STATUS.QUARANTINED,
    ATTACHMENT_STATUS.ISOLATED
  ];

  if (!allowedStatuses.includes(attachment.status)) {
    return res.status(400).json({
      error: `Cannot release from current status: ${attachment.status}`,
      allowedFrom: allowedStatuses
    });
  }

  const updated = updateAttachmentStatus(attachment.id, ATTACHMENT_STATUS.MANUALLY_RELEASED, {
    manuallyReleasedBy: releasedBy,
    manuallyReleasedReason: reason.trim(),
    manuallyReleasedAt: new Date().toISOString(),
    riskReason: attachment.riskReason
  });

  res.json({
    attachment: updated,
    message: 'Attachment manually released',
    releaseInfo: {
      releasedBy: updated.manuallyReleasedBy,
      reason: updated.manuallyReleasedReason,
      releasedAt: updated.manuallyReleasedAt
    }
  });
});

router.post('/:id/reference', requireAttachment, (req, res) => {
  const attachment = req.attachment;
  const { businessType, businessId } = req.body;

  if (!businessType || !businessId) {
    return res.status(400).json({ error: 'businessType and businessId are required' });
  }

  if (!USABLE_STATUSES.includes(attachment.status)) {
    return res.status(403).json({
      error: 'Attachment cannot be referenced',
      reason: getUnavailableReason(attachment)
    });
  }

  const reference = addBusinessReference(attachment.id, businessType, businessId);

  res.json({
    message: 'Attachment referenced successfully',
    reference,
    attachment: {
      id: attachment.id,
      status: attachment.status
    }
  });
});

router.get('/:id', requireAttachment, (req, res) => {
  const attachment = req.attachment;
  const scanRecords = getScanRecords(attachment.id);
  const auditLogs = getAuditLogs(attachment.id);
  const businessReferences = getBusinessReferences(attachment.id);

  res.json({
    ...attachment,
    scanRecords,
    auditLogs,
    businessReferences,
    canDownload: DOWNLOADABLE_STATUSES.includes(attachment.status),
    canReference: USABLE_STATUSES.includes(attachment.status),
    unavailableReason: getUnavailableReason(attachment)
  });
});

router.get('/:id/download', requireAttachment, (req, res) => {
  const attachment = req.attachment;

  if (!DOWNLOADABLE_STATUSES.includes(attachment.status)) {
    return res.status(403).json({
      error: 'Attachment cannot be downloaded',
      reason: getUnavailableReason(attachment),
      riskReason: attachment.riskReason
    });
  }

  res.json({
    message: 'Download authorized (simulated)',
    attachment: {
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size
    }
  });
});

function getUnavailableReason(attachment) {
  switch (attachment.status) {
    case ATTACHMENT_STATUS.ISOLATED:
      return 'Attachment is in quarantine zone awaiting virus scan';
    case ATTACHMENT_STATUS.SCANNING:
      return 'Attachment is currently being scanned for viruses';
    case ATTACHMENT_STATUS.QUARANTINED:
      return 'Attachment quarantined - requires review';
    case ATTACHMENT_STATUS.FAILED:
      return `Attachment failed virus scan: ${attachment.riskReason || 'Security risk detected'}`;
    default:
      return 'Attachment unavailable';
  }
}

module.exports = router;
