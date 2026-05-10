const artifactService = require('./artifactService');
const signatureService = require('./signatureService');
const scanService = require('./scanService');
const approvalService = require('./approvalService');
const promotionService = require('./promotionService');
const rollbackService = require('./rollbackService');
const gateRuleService = require('./gateRuleService');
const auditService = require('./auditService');

function getArtifactFullReport(artifactId) {
  const artifact = artifactService.getArtifactById(artifactId);
  if (!artifact) {
    throw new Error('制品不存在');
  }

  const signatures = signatureService.getSignaturesForArtifact(artifactId);
  const scans = scanService.getScansForArtifact(artifactId);
  const approvals = approvalService.getApprovalsForArtifact(artifactId);
  const promotions = promotionService.getPromotionHistory(artifactId);
  const rollbacks = rollbackService.getRollbacksForArtifact(artifactId);
  const auditLog = auditService.getAuditLog('artifact', artifactId, 50);
  const gateStatus = gateRuleService.evaluateGate(artifactId);

  const latestPromotion = promotions.length > 0 ? promotions[0] : null;
  const latestScan = scans.length > 0 ? scans[0] : null;
  const hasRollback = rollbacks.length > 0;

  return {
    artifact: {
      id: artifact.id,
      name: artifact.name,
      version: artifact.version,
      repository: artifact.repository,
      currentStage: artifact.stage,
      metadata: artifact.metadata
    },
    gateCheck: gateStatus,
    signatures: {
      total: signatures.length,
      valid: signatures.filter(s => s.is_valid === 1).length,
      items: signatures
    },
    securityScans: {
      total: scans.length,
      passed: scans.filter(s => s.is_passed === 1).length,
      latest: latestScan,
      items: scans
    },
    approvals: {
      total: approvals.length,
      approved: approvals.filter(a => a.status === 'approved').length,
      rejected: approvals.filter(a => a.status === 'rejected').length,
      pending: approvals.filter(a => a.status === 'pending').length,
      items: approvals
    },
    promotionHistory: {
      total: promotions.length,
      passed: promotions.filter(p => p.status === 'passed').length,
      failed: promotions.filter(p => p.status === 'failed').length,
      latest: latestPromotion,
      items: promotions
    },
    rollbackHistory: {
      hasRollback,
      total: rollbacks.length,
      items: rollbacks
    },
    auditTrail: auditLog,
    summary: {
      canPromote: gateStatus.summary.allPassed,
      currentStage: artifact.stage,
      hasValidSignature: signatures.some(s => s.is_valid === 1),
      hasPassedScan: scans.some(s => s.is_passed === 1),
      hasApproved: approvals.some(a => a.status === 'approved'),
      hasRollbackMarker: hasRollback,
      generatedAt: new Date().toISOString()
    }
  };
}

function getDashboardSummary() {
  const testArtifacts = artifactService.listArtifacts('test', 1000);
  const productionArtifacts = artifactService.listArtifacts('production', 1000);
  const allPromotions = promotionService.listPromotionRequests(null, 1000);
  
  const passedPromotions = allPromotions.filter(p => p.status === 'passed');
  const failedPromotions = allPromotions.filter(p => p.status === 'failed');
  const pendingApprovals = approvalService.getPendingApprovals();

  const rules = gateRuleService.getAllRules();

  return {
    artifacts: {
      test: testArtifacts.length,
      production: productionArtifacts.length
    },
    promotions: {
      total: allPromotions.length,
      passed: passedPromotions.length,
      failed: failedPromotions.length,
      successRate: allPromotions.length > 0 
        ? Math.round((passedPromotions.length / allPromotions.length) * 100) 
        : 0
    },
    approvals: {
      pending: pendingApprovals.length
    },
    gateRules: {
      total: rules.length,
      enabled: rules.filter(r => r.is_enabled).length,
      disabled: rules.filter(r => !r.is_enabled).length
    },
    generatedAt: new Date().toISOString()
  };
}

function getPromotionReport(promotionId) {
  const promotion = promotionService.getPromotionRequestById(promotionId);
  if (!promotion) {
    throw new Error('晋级请求不存在');
  }

  const artifact = artifactService.getArtifactById(promotion.artifact_id);
  const auditLog = auditService.getAuditLog('promotion', promotionId);

  return {
    promotion,
    artifact,
    gateChecks: promotion.gate_checks,
    auditTrail: auditLog
  };
}

module.exports = {
  getArtifactFullReport,
  getDashboardSummary,
  getPromotionReport
};
