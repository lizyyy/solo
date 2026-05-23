const { runQuery, getOne, getAll } = require('../database');
const { generateNo } = require('../utils/generator');
const { createProcessingLog } = require('./exceptionService');

async function uploadEvidence(exceptionRecordId, uploaderId, evidenceType, evidenceUrl, description, rawInput = null) {
  const evidenceNo = generateNo('EVI');
  
  const result = await runQuery(
    `INSERT INTO appeal_evidences (evidence_no, exception_record_id, uploader_id, evidence_type, evidence_url, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [evidenceNo, exceptionRecordId, uploaderId, evidenceType, evidenceUrl, description]
  );
  
  await createProcessingLog(
    exceptionRecordId,
    'upload_evidence',
    `rider_${uploaderId}`,
    null,
    null,
    rawInput,
    `上传${evidenceType}证据`
  );
  
  return getEvidenceById(result.id);
}

async function getEvidenceById(id) {
  return getOne(
    `SELECT ae.*, r.name as uploader_name
     FROM appeal_evidences ae
     LEFT JOIN riders r ON ae.uploader_id = r.id
     WHERE ae.id = ?`,
    [id]
  );
}

async function verifyEvidence(evidenceId, verified, verifiedBy, rawInput = null) {
  const evidence = await getEvidenceById(evidenceId);
  if (!evidence) {
    throw new Error('证据不存在');
  }
  
  await runQuery(
    `UPDATE appeal_evidences 
     SET verified = ?, verified_by = ?, verified_time = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [verified ? 1 : 0, verifiedBy, evidenceId]
  );
  
  await createProcessingLog(
    evidence.exception_record_id,
    'verify_evidence',
    verifiedBy,
    null,
    null,
    rawInput,
    `证据${verified ? '通过' : '未通过'}审核`
  );
  
  return getEvidenceById(evidenceId);
}

async function queryEvidences(params = {}) {
  let sql = `SELECT ae.*, r.name as uploader_name
             FROM appeal_evidences ae
             LEFT JOIN riders r ON ae.uploader_id = r.id
             WHERE 1=1`;
  const values = [];
  
  if (params.exceptionRecordId) {
    sql += ` AND ae.exception_record_id = ?`;
    values.push(params.exceptionRecordId);
  }
  if (params.verified !== undefined) {
    sql += ` AND ae.verified = ?`;
    values.push(params.verified ? 1 : 0);
  }
  
  sql += ` ORDER BY ae.upload_time DESC`;
  
  return getAll(sql, values);
}

module.exports = {
  uploadEvidence,
  getEvidenceById,
  verifyEvidence,
  queryEvidences
};
