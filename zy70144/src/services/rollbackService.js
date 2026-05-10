const { v4: uuidv4 } = require('uuid');
const { table, insert } = require('../config/database');
const artifactService = require('./artifactService');
const auditService = require('./auditService');

function createRollback(artifactId, promotionRequestId, reason, actor = 'system') {
  const now = new Date().toISOString();
  const id = uuidv4();

  const artifact = table('artifacts').where('id', '=', artifactId).get();
  if (!artifact) {
    throw new Error('制品不存在');
  }

  let fromStage = artifact.stage;
  let toStage = 'test';

  if (promotionRequestId) {
    const promotion = table('promotion_requests')
      .where('id', '=', promotionRequestId)
      .where('artifact_id', '=', artifactId)
      .where('status', '=', 'passed')
      .get();
    
    if (promotion) {
      fromStage = promotion.target_stage;
      toStage = promotion.source_stage;
    }
  }

  if (fromStage === toStage) {
    throw new Error(`制品已经在 ${toStage} 阶段，无法回滚`);
  }

  insert('rollbacks', {
    id,
    artifact_id: artifactId,
    promotion_request_id: promotionRequestId || null,
    rollback_reason: reason,
    rollback_by: actor,
    rolled_back_at: now,
    from_stage: fromStage,
    to_stage: toStage
  });

  artifactService.updateArtifactStage(artifactId, toStage, actor);

  auditService.logAction('rollback', id, 'execute', actor, {
    artifactId,
    promotionRequestId,
    from: fromStage,
    to: toStage,
    reason
  });

  return getRollbackById(id);
}

function getRollbackById(id) {
  return table('rollbacks').where('id', '=', id).get();
}

function getRollbacksForArtifact(artifactId) {
  return table('rollbacks')
    .where('artifact_id', '=', artifactId)
    .orderBy('rolled_back_at', 'DESC')
    .all();
}

function hasRollbackMarker(artifactId) {
  const count = table('rollbacks').where('artifact_id', '=', artifactId).count();
  return count > 0;
}

module.exports = {
  createRollback,
  getRollbackById,
  getRollbacksForArtifact,
  hasRollbackMarker
};
