const { v4: uuidv4 } = require('uuid');
const { table, insert, updateById } = require('../config/database');
const artifactService = require('./artifactService');
const gateRuleService = require('./gateRuleService');
const auditService = require('./auditService');

const VALID_STAGES = ['test', 'staging', 'production'];

function createPromotionRequest(artifactId, targetStage, actor = 'system') {
  const now = new Date().toISOString();
  const id = uuidv4();

  const artifact = table('artifacts').where('id', '=', artifactId).get();
  if (!artifact) {
    throw new Error('制品不存在');
  }
  if (!VALID_STAGES.includes(targetStage)) {
    throw new Error(`无效的目标阶段: ${targetStage}`);
  }
  if (artifact.stage === targetStage) {
    throw new Error(`制品已经在 ${targetStage} 阶段`);
  }

  insert('promotion_requests', {
    id,
    artifact_id: artifactId,
    source_stage: artifact.stage,
    target_stage: targetStage,
    status: 'checking',
    gate_checks: null,
    requested_by: actor,
    requested_at: now,
    completed_at: null,
    failure_reason: null
  });

  auditService.logAction('promotion', id, 'create', actor, {
    artifactId,
    from: artifact.stage,
    to: targetStage
  });

  const gateResult = gateRuleService.evaluateGate(artifactId);
  const isPassed = gateResult.summary.allPassed;

  updateById('promotion_requests', id, {
    gate_checks: JSON.stringify(gateResult),
    status: isPassed ? 'passed' : 'failed',
    completed_at: now,
    failure_reason: isPassed ? null : gateResult.summary.failedRuleNames.join('; ')
  });

  if (isPassed) {
    artifactService.updateArtifactStage(artifactId, targetStage, actor);
    auditService.logAction('promotion', id, 'execute', actor, {
      artifactId,
      to: targetStage
    });
  } else {
    auditService.logAction('promotion', id, 'blocked', actor, {
      artifactId,
      failedRules: gateResult.summary.failedRuleNames
    });
  }

  return getPromotionRequestById(id);
}

function getPromotionRequestById(id) {
  const req = table('promotion_requests').where('id', '=', id).get();
  if (!req) return null;
  
  return {
    ...req,
    gate_checks: req.gate_checks ? JSON.parse(req.gate_checks) : null
  };
}

function getPromotionHistory(artifactId) {
  const requests = table('promotion_requests')
    .where('artifact_id', '=', artifactId)
    .orderBy('requested_at', 'DESC')
    .all();
  
  return requests.map(req => ({
    ...req,
    gate_checks: req.gate_checks ? JSON.parse(req.gate_checks) : null
  }));
}

function listPromotionRequests(status, limit = 100) {
  let query = table('promotion_requests');
  
  if (status) {
    query = query.where('status', '=', status);
  }

  return query
    .orderBy('requested_at', 'DESC')
    .limit(limit)
    .all()
    .map(req => ({
      ...req,
      gate_checks: req.gate_checks ? JSON.parse(req.gate_checks) : null
    }));
}

module.exports = {
  createPromotionRequest,
  getPromotionRequestById,
  getPromotionHistory,
  listPromotionRequests,
  VALID_STAGES
};
