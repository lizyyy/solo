const { v4: uuidv4 } = require('uuid');
const { table, insert } = require('../config/database');
const auditService = require('./auditService');

function recordScan(artifactId, scanner, scanResult, actor = 'system') {
  const now = new Date().toISOString();
  const id = uuidv4();

  insert('security_scans', {
    id,
    artifact_id: artifactId,
    scanner,
    scan_time: scanResult.scanTime || now,
    critical_count: scanResult.critical || 0,
    high_count: scanResult.high || 0,
    medium_count: scanResult.medium || 0,
    low_count: scanResult.low || 0,
    report_url: scanResult.reportUrl || null,
    is_passed: scanResult.passed ? true : false,
    scan_result: JSON.stringify(scanResult),
    created_at: now
  });

  auditService.logAction('scan', id, 'record', actor, {
    artifactId,
    scanner,
    passed: scanResult.passed,
    critical: scanResult.critical || 0,
    high: scanResult.high || 0
  });

  return getScanById(id);
}

function getScanById(id) {
  const scan = table('security_scans').where('id', '=', id).get();
  if (!scan) return null;
  return {
    ...scan,
    scan_result: scan.scan_result ? JSON.parse(scan.scan_result) : null
  };
}

function getLatestScanForArtifact(artifactId) {
  const scan = table('security_scans')
    .where('artifact_id', '=', artifactId)
    .orderBy('scan_time', 'DESC')
    .limit(1)
    .get();
  
  if (!scan) return null;
  return {
    ...scan,
    scan_result: scan.scan_result ? JSON.parse(scan.scan_result) : null
  };
}

function getScansForArtifact(artifactId, limit = 20) {
  const scans = table('security_scans')
    .where('artifact_id', '=', artifactId)
    .orderBy('scan_time', 'DESC')
    .limit(limit)
    .all();
  
  return scans.map(scan => ({
    ...scan,
    scan_result: scan.scan_result ? JSON.parse(scan.scan_result) : null
  }));
}

function hasPassingScan(artifactId) {
  const count = table('security_scans')
    .where('artifact_id', '=', artifactId)
    .where('is_passed', '=', true)
    .count();
  return count > 0;
}

module.exports = {
  recordScan,
  getScanById,
  getLatestScanForArtifact,
  getScansForArtifact,
  hasPassingScan
};
