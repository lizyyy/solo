const { v4: uuidv4 } = require('uuid');
const { table, insert, updateById } = require('../config/database');
const auditService = require('./auditService');

function addSignature(artifactId, signer, signature, algorithm = 'sha256', actor = 'system') {
  const now = new Date().toISOString();
  const id = uuidv4();

  insert('signatures', {
    id,
    artifact_id: artifactId,
    signer,
    signature,
    algorithm,
    signed_at: now,
    verified_at: null,
    is_valid: false
  });

  auditService.logAction('signature', id, 'create', actor, {
    artifactId, signer, algorithm
  });

  return getSignatureById(id);
}

function verifySignature(signatureId, isVerified, actor = 'system') {
  const signature = table('signatures').where('id', '=', signatureId).get();
  if (!signature) {
    throw new Error('签名记录不存在');
  }

  updateById('signatures', signatureId, {
    verified_at: new Date().toISOString(),
    is_valid: isVerified ? true : false
  });

  auditService.logAction('signature', signatureId, 'verify', actor, {
    isValid: isVerified,
    artifactId: signature.artifact_id
  });

  return getSignatureById(signatureId);
}

function getSignatureById(id) {
  return table('signatures').where('id', '=', id).get();
}

function getSignaturesForArtifact(artifactId) {
  return table('signatures')
    .where('artifact_id', '=', artifactId)
    .orderBy('signed_at', 'DESC')
    .all();
}

function getValidSignatureCount(artifactId) {
  return table('signatures')
    .where('artifact_id', '=', artifactId)
    .where('is_valid', '=', true)
    .count();
}

module.exports = {
  addSignature,
  verifySignature,
  getSignatureById,
  getSignaturesForArtifact,
  getValidSignatureCount
};
