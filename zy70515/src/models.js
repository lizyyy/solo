const { v4: uuidv4 } = require('uuid');
const CryptoJS = require('crypto-js');
const db = require('./database');

const PACKAGE_STATUSES = {
  CREATED: 'created',
  WATERMARKED: 'watermarked',
  AUTHORIZED: 'authorized',
  DOWNLOADED: 'downloaded',
  REVOKED: 'revoked'
};

const generateWatermark = (packageId, downloaderId, timestamp) => {
  const secret = process.env.WATERMARK_SECRET || 'audit-evidence-secret-2024';
  const data = `${packageId}:${downloaderId}:${timestamp}`;
  const hash = CryptoJS.HmacSHA256(data, secret).toString(CryptoJS.enc.Hex);
  return `AUDIT-${hash.substring(0, 16).toUpperCase()}`;
};

const createEvidencePackage = (data) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  const pkg = {
    id,
    caseId: data.caseId,
    evidenceType: data.evidenceType,
    fileName: data.fileName,
    fileHash: data.fileHash,
    description: data.description || '',
    status: PACKAGE_STATUSES.CREATED,
    createdAt: now,
    updatedAt: now,
    metadata: data.metadata || {}
  };
  db.get('evidencePackages').push(pkg).write();
  return pkg;
};

const getEvidencePackage = (id) => {
  return db.get('evidencePackages').find({ id }).value();
};

const listEvidencePackages = (filters = {}) => {
  let query = db.get('evidencePackages');
  if (filters.status) query = query.filter({ status: filters.status });
  if (filters.caseId) query = query.filter({ caseId: filters.caseId });
  return query.value();
};

const updatePackageStatus = (packageId, newStatus, reason = '') => {
  const pkg = getEvidencePackage(packageId);
  if (!pkg) return null;
  
  if (pkg.status === newStatus) {
    return pkg;
  }
  
  const validTransitions = {
    [PACKAGE_STATUSES.CREATED]: [PACKAGE_STATUSES.WATERMARKED],
    [PACKAGE_STATUSES.WATERMARKED]: [PACKAGE_STATUSES.AUTHORIZED],
    [PACKAGE_STATUSES.AUTHORIZED]: [PACKAGE_STATUSES.DOWNLOADED, PACKAGE_STATUSES.REVOKED],
    [PACKAGE_STATUSES.DOWNLOADED]: [PACKAGE_STATUSES.REVOKED]
  };
  
  if (!validTransitions[pkg.status]?.includes(newStatus)) {
    throw new Error(`Invalid status transition: ${pkg.status} -> ${newStatus}`);
  }
  
  const updated = db.get('evidencePackages')
    .find({ id: packageId })
    .assign({ status: newStatus, updatedAt: new Date().toISOString() })
    .write();
  
  addAuditLog(packageId, `status_changed`, { from: pkg.status, to: newStatus, reason });
  
  return updated;
};

const getOrCreateDownloader = (data) => {
  let downloader = db.get('downloaders').find({ employeeId: data.employeeId }).value();
  if (downloader) return downloader;
  
  const id = uuidv4();
  downloader = {
    id,
    employeeId: data.employeeId,
    name: data.name,
    department: data.department,
    email: data.email,
    createdAt: new Date().toISOString()
  };
  db.get('downloaders').push(downloader).write();
  return downloader;
};

const createWatermark = (packageId, downloaderId, customText = '') => {
  const pkg = getEvidencePackage(packageId);
  if (!pkg) throw new Error('Package not found');
  
  const existing = db.get('watermarks').find({ packageId, downloaderId }).value();
  if (existing) return existing;
  
  const id = uuidv4();
  const now = new Date().toISOString();
  const watermarkText = generateWatermark(packageId, downloaderId, now);
  const fullWatermark = customText ? `${customText} | ${watermarkText}` : watermarkText;
  
  const watermark = {
    id,
    packageId,
    downloaderId,
    watermarkText: fullWatermark,
    generatedAt: now,
    applied: false
  };
  
  db.get('watermarks').push(watermark).write();
  updatePackageStatus(packageId, PACKAGE_STATUSES.WATERMARKED, 'Watermark generated');
  
  return watermark;
};

const getWatermark = (id) => {
  return db.get('watermarks').find({ id }).value();
};

const listWatermarks = (packageId) => {
  return db.get('watermarks').filter({ packageId }).value();
};

const createAuthorization = (packageId, downloaderId, scope, expiresAt, grantedBy) => {
  const pkg = getEvidencePackage(packageId);
  if (!pkg) throw new Error('Package not found');
  
  const existing = db.get('authorizations').find({ 
    packageId, 
    downloaderId,
    revoked: false 
  }).value();
  
  if (existing) return existing;
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const auth = {
    id,
    packageId,
    downloaderId,
    scope: scope || 'view',
    grantedAt: now,
    expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    grantedBy,
    revoked: false
  };
  
  db.get('authorizations').push(auth).write();
  updatePackageStatus(packageId, PACKAGE_STATUSES.AUTHORIZED, 'Authorization granted');
  
  return auth;
};

const getAuthorization = (id) => {
  return db.get('authorizations').find({ id }).value();
};

const checkAuthorization = (packageId, downloaderId) => {
  const auth = db.get('authorizations').find({
    packageId,
    downloaderId,
    revoked: false
  }).value();
  
  if (!auth) return { authorized: false, reason: 'No authorization found' };
  if (new Date(auth.expiresAt) < new Date()) {
    return { authorized: false, reason: 'Authorization expired' };
  }
  
  return { authorized: true, auth };
};

const revokeAuthorization = (authId, reason, revokedBy) => {
  const auth = getAuthorization(authId);
  if (!auth) throw new Error('Authorization not found');
  if (auth.revoked) return auth;
  
  const updated = db.get('authorizations')
    .find({ id: authId })
    .assign({ revoked: true, revokedAt: new Date().toISOString(), revokedBy, revocationReason: reason })
    .write();
  
  const id = uuidv4();
  db.get('revocationRecords').push({
    id,
    authorizationId: authId,
    packageId: auth.packageId,
    downloaderId: auth.downloaderId,
    reason,
    revokedBy,
    revokedAt: new Date().toISOString()
  }).write();
  
  updatePackageStatus(auth.packageId, PACKAGE_STATUSES.REVOKED, reason);
  addAuditLog(auth.packageId, 'authorization_revoked', { authId, reason });
  
  return updated;
};

const recordDownload = (packageId, downloaderId, ipAddress) => {
  const check = checkAuthorization(packageId, downloaderId);
  if (!check.authorized) throw new Error(check.reason);
  
  const existingRecord = db.get('trackingSummaries')
    .find({ packageId, downloaderId })
    .value();
  
  if (existingRecord) {
    return existingRecord;
  }
  
  const pkg = getEvidencePackage(packageId);
  if (pkg && pkg.status === PACKAGE_STATUSES.DOWNLOADED) {
    const existingDownload = db.get('trackingSummaries')
      .filter({ packageId })
      .value();
    if (existingDownload.length > 0) {
      throw new Error('Package already downloaded, duplicate download not allowed');
    }
  }
  
  const now = new Date().toISOString();
  const summaryId = uuidv4();
  
  const summary = {
    id: summaryId,
    packageId,
    downloaderId,
    downloadedAt: now,
    ipAddress,
    userAgent: '',
    downloadCount: 1
  };
  
  db.get('trackingSummaries').push(summary).write();
  
  try {
    updatePackageStatus(packageId, PACKAGE_STATUSES.DOWNLOADED, 'Package downloaded');
  } catch (statusError) {
    db.get('trackingSummaries').remove({ id: summaryId }).write();
    throw statusError;
  }
  
  addAuditLog(packageId, 'downloaded', { downloaderId, ipAddress });
  
  return summary;
};

const getTrackingSummary = (packageId) => {
  return db.get('trackingSummaries').filter({ packageId }).value();
};

const recordFailure = (operation, input, reason, conclusion) => {
  const id = uuidv4();
  const failure = {
    id,
    operation,
    originalInput: input,
    processingBasis: reason,
    finalConclusion: conclusion,
    timestamp: new Date().toISOString()
  };
  db.get('failureRecords').push(failure).write();
  return failure;
};

const listFailures = (operation = null) => {
  let query = db.get('failureRecords');
  if (operation) query = query.filter({ operation });
  return query.value();
};

const addAuditLog = (packageId, action, details = {}) => {
  const log = {
    id: uuidv4(),
    packageId,
    action,
    details,
    timestamp: new Date().toISOString()
  };
  db.get('auditLogs').push(log).write();
  return log;
};

const manualCorrect = (packageId, corrections, correctedBy) => {
  const pkg = getEvidencePackage(packageId);
  if (!pkg) throw new Error('Package not found');
  
  const allowedFields = ['description', 'metadata', 'caseId'];
  const changes = {};
  for (const field of allowedFields) {
    if (corrections[field] !== undefined) {
      changes[field] = corrections[field];
    }
  }
  
  changes.updatedAt = new Date().toISOString();
  
  const updated = db.get('evidencePackages')
    .find({ id: packageId })
    .assign(changes)
    .write();
  
  addAuditLog(packageId, 'manual_correction', { corrections, correctedBy });
  
  return updated;
};

const exportTrackingData = (packageId = null) => {
  let packages = packageId 
    ? [getEvidencePackage(packageId)].filter(Boolean)
    : listEvidencePackages();
  
  const allFailures = listFailures();
  
  return packages.map(pkg => {
    const watermarks = listWatermarks(pkg.id);
    const authorizations = db.get('authorizations').filter({ packageId: pkg.id }).value();
    const tracking = getTrackingSummary(pkg.id);
    const revocations = db.get('revocationRecords').filter({ packageId: pkg.id }).value();
    const logs = db.get('auditLogs').filter({ packageId: pkg.id }).value();
    
    const packageFailures = allFailures.filter(f => {
      if (f.originalInput && typeof f.originalInput === 'object') {
        return f.originalInput.packageId === pkg.id;
      }
      return false;
    });
    
    return {
      package: {
        id: pkg.id,
        caseId: pkg.caseId,
        fileName: pkg.fileName,
        status: pkg.status,
        createdAt: pkg.createdAt
      },
      watermarks: watermarks.map(w => ({
        watermarkText: w.watermarkText,
        generatedAt: w.generatedAt
      })),
      authorizations: authorizations.map(a => ({
        downloaderId: a.downloaderId,
        scope: a.scope,
        grantedAt: a.grantedAt,
        revoked: a.revoked
      })),
      downloadHistory: tracking.map(t => ({
        downloadedAt: t.downloadedAt,
        ipAddress: t.ipAddress
      })),
      revocations: revocations.map(r => ({
        reason: r.reason,
        revokedAt: r.revokedAt
      })),
      auditLog: logs.map(l => ({
        action: l.action,
        timestamp: l.timestamp
      })),
      failureRecords: packageFailures.map(f => ({
        id: f.id,
        operation: f.operation,
        originalInput: f.originalInput,
        processingBasis: f.processingBasis,
        finalConclusion: f.finalConclusion,
        timestamp: f.timestamp
      }))
    };
  });
};

const getAuditLogs = (packageId) => {
  return db.get('auditLogs').filter({ packageId }).value();
};

module.exports = {
  PACKAGE_STATUSES,
  createEvidencePackage,
  getEvidencePackage,
  listEvidencePackages,
  updatePackageStatus,
  getOrCreateDownloader,
  createWatermark,
  getWatermark,
  listWatermarks,
  createAuthorization,
  getAuthorization,
  checkAuthorization,
  revokeAuthorization,
  recordDownload,
  getTrackingSummary,
  recordFailure,
  listFailures,
  manualCorrect,
  exportTrackingData,
  getAuditLogs
};
