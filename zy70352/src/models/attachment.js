const { v4: uuidv4 } = require('uuid');

const ATTACHMENT_STATUS = {
  ISOLATED: 'isolated',
  SCANNING: 'scanning',
  QUARANTINED: 'quarantined',
  USABLE: 'usable',
  FAILED: 'failed',
  MANUALLY_RELEASED: 'manually_released'
};

const SCAN_RESULT = {
  PENDING: 'pending',
  CLEAN: 'clean',
  SUSPICIOUS: 'suspicious',
  INFECTED: 'infected'
};

const attachments = new Map();
const scanRecords = new Map();
const auditLogs = new Map();
const businessReferences = new Map();

function createAttachment(metadata) {
  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const attachment = {
    id,
    filename: metadata.filename,
    contentType: metadata.contentType || 'application/octet-stream',
    size: metadata.size || 0,
    customerId: metadata.customerId,
    uploadSource: metadata.uploadSource || 'customer',
    status: ATTACHMENT_STATUS.ISOLATED,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    scanCount: 0,
    lastScanResult: null,
    riskReason: null,
    manuallyReleasedBy: null,
    manuallyReleasedReason: null,
    manuallyReleasedAt: null
  };

  attachments.set(id, attachment);
  addAuditLog(id, 'created', {
    customerId: metadata.customerId,
    filename: metadata.filename,
    size: metadata.size
  });

  return attachment;
}

function getAttachment(id) {
  return attachments.get(id);
}

function updateAttachmentStatus(id, status, updates = {}) {
  const attachment = attachments.get(id);
  if (!attachment) return null;

  const previousStatus = attachment.status;
  attachment.status = status;
  attachment.updatedAt = new Date().toISOString();

  Object.assign(attachment, updates);

  addAuditLog(id, 'status_changed', {
    from: previousStatus,
    to: status,
    ...updates
  });

  return attachment;
}

function deleteAttachment(id) {
  const attachment = attachments.get(id);
  if (!attachment) return false;

  attachments.delete(id);
  scanRecords.delete(id);
  auditLogs.delete(id);
  businessReferences.delete(id);

  return true;
}

function getAllAttachments() {
  return Array.from(attachments.values());
}

function addScanRecord(attachmentId, result, details = {}) {
  const records = scanRecords.get(attachmentId) || [];
  const record = {
    id: uuidv4(),
    attachmentId,
    result,
    details,
    scannedAt: new Date().toISOString()
  };
  records.push(record);
  scanRecords.set(attachmentId, records);

  addAuditLog(attachmentId, 'scan', {
    result,
    ...details
  });

  return record;
}

function getScanRecords(attachmentId) {
  return scanRecords.get(attachmentId) || [];
}

function addAuditLog(attachmentId, action, details = {}) {
  const logs = auditLogs.get(attachmentId) || [];
  const log = {
    id: uuidv4(),
    attachmentId,
    action,
    details,
    timestamp: new Date().toISOString()
  };
  logs.push(log);
  auditLogs.set(attachmentId, logs);
  return log;
}

function getAuditLogs(attachmentId) {
  return auditLogs.get(attachmentId) || [];
}

function addBusinessReference(attachmentId, businessType, businessId) {
  const references = businessReferences.get(attachmentId) || [];
  const reference = {
    id: uuidv4(),
    attachmentId,
    businessType,
    businessId,
    createdAt: new Date().toISOString()
  };
  references.push(reference);
  businessReferences.set(attachmentId, references);

  addAuditLog(attachmentId, 'business_referenced', {
    businessType,
    businessId
  });

  return reference;
}

function getBusinessReferences(attachmentId) {
  return businessReferences.get(attachmentId) || [];
}

module.exports = {
  ATTACHMENT_STATUS,
  SCAN_RESULT,
  createAttachment,
  getAttachment,
  updateAttachmentStatus,
  deleteAttachment,
  getAllAttachments,
  addScanRecord,
  getScanRecords,
  addAuditLog,
  getAuditLogs,
  addBusinessReference,
  getBusinessReferences
};
